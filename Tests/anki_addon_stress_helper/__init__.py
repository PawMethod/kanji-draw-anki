"""
KanjiDraw Stress Test Helper Addon  (v7 — callback + loadFinished re-dispatch)
=================================================================================
Exposes a local HTTP server at port 8767 so the external stress test script
can execute arbitrary JavaScript in Anki's card WebView.

Endpoints:
  POST /eval        — fire-and-forget: runs JS, returns immediately
  POST /eval_sync   — runs JS, waits up to 30s for the return value
                      Re-dispatches JS on loadFinished and every 2s via retry
  DELETE /shutdown  — gracefully shut down the server

Body for POST: {"js": "<javascript code>"}
Response:      {"result": <value_or_null>, "error": <string_or_null>}

Security:
  Every request must carry "Authorization: Bearer <token>" and
  "Content-Type: application/json"; requests with an Origin header are
  rejected. The token is regenerated on each Anki start and written to
  <tempdir>/kanjidraw_stress_token (mode 0600), where live_stress_test.py
  reads it. This blocks websites from reaching the eval endpoint (CSRF).
  Only install this add-on while running the stress tests.

Architecture (v7):
  A Qt main-thread QTimer (50ms) dequeues JS requests and fires them via
  page.runJavaScript(). The JS returns a sentinel object {"ok":1,"v":<result>}
  and the PyQt6 runJavaScript result-callback delivers it directly to the
  waiting server thread — no pycmd / QWebChannel needed.

  Additionally, the page's loadFinished signal is monitored. Every time the
  page finishes a navigation (setHtml / load), ALL queued eval_sync callbacks
  are immediately re-dispatched. This means the bridge responds within ~100ms
  of the final card load completing, even after N rapid card flips.

  If a callback fires with non-sentinel (page navigating / None), it is
  ignored and the next re-dispatch (either from loadFinished or 2s retry)
  will try again.

Installation: copy this folder into Anki's addons21 directory and restart Anki.
"""
import hmac, os, secrets, sys, queue, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from aqt import mw
from aqt.qt import QTimer

_t0 = time.time()
def _log(msg): print(f"[KDv7 +{time.time()-_t0:.1f}s] {msg}", file=sys.stderr, flush=True)

PORT = 8767
_server = None

TOKEN_FILE = os.path.join(tempfile.gettempdir(), "kanjidraw_stress_token")
_TOKEN = secrets.token_urlsafe(32)


def _write_token():
    try:
        os.unlink(TOKEN_FILE)
    except FileNotFoundError:
        pass
    fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(_TOKEN)

# Thread-safe queue: items are either plain str (fire-and-forget)
# or (str, callable) tuples (eval_sync — callback receives the JS result).
_fire_queue: queue.Queue = queue.Queue()

# Strong refs to all in-flight callbacks to prevent Python GC from collecting
# them before Qt fires the runJavaScript result callback.
_cb_refs: set = set()
_cb_refs_lock = threading.Lock()

# Tracks the current connected page so we can reconnect loadFinished on flip.
_connected_page = None

# All in-flight eval_sync JS strings for re-dispatch on loadFinished.
# Map: id(callback_set) → set of (js_exec, cb) pairs per active eval_sync request.
_in_flight_js: dict = {}  # req_id → (js_exec, weak-cb-set)
_in_flight_lock = threading.Lock()
_req_counter = 0
_req_lock = threading.Lock()


def _next_req_id():
    global _req_counter
    with _req_lock:
        _req_counter += 1
        return _req_counter


# Persistent no-op callback
def _noop(_): pass


def _get_page():
    """Return the reviewer QWebEnginePage, or None if not in active review."""
    try:
        if mw and mw.reviewer and mw.reviewer.web:
            return mw.reviewer.web.page()
    except Exception:
        pass
    return None


def _on_load_finished(ok):
    """Fired by Qt on the main thread when the reviewer page finishes loading.
    Re-dispatches all in-flight eval_sync JS so they run on the fresh page."""
    _log(f"loadFinished ok={ok}, in_flight={len(_in_flight_js)}")
    if not ok:
        return
    page = _get_page()
    if not page:
        return
    with _in_flight_lock:
        entries = list(_in_flight_js.values())
    for js_exec, make_cb in entries:
        cb = make_cb()
        with _cb_refs_lock:
            _cb_refs.add(cb)
        try:
            page.runJavaScript(js_exec, cb)
        except Exception:
            with _cb_refs_lock:
                _cb_refs.discard(cb)


def _poll():
    """Qt main thread, 50ms: dispatch queued JS and reconnect loadFinished."""
    global _connected_page
    page = _get_page()
    if not page:
        return

    # Reconnect loadFinished when the page object changes (e.g. reviewer reinit).
    if page is not _connected_page:
        if _connected_page is not None:
            try:
                _connected_page.loadFinished.disconnect(_on_load_finished)
            except Exception:
                pass
        try:
            page.loadFinished.connect(_on_load_finished)
            _log(f"connected loadFinished to page id={id(page)}")
        except Exception as ex:
            _log(f"FAILED to connect loadFinished: {ex}")
        _connected_page = page

    while not _fire_queue.empty():
        try:
            item = _fire_queue.get_nowait()
        except queue.Empty:
            break
        try:
            if isinstance(item, tuple):
                js, cb = item
                page.runJavaScript(js, cb)
            else:
                page.runJavaScript(item, _noop)
        except Exception as ex:
            _log(f"runJavaScript error: {ex}")


class _ThreadingServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send_json(self, code, body):
        import json
        data = json.dumps(body).encode()
        try:
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _authorized(self):
        if self.headers.get("Origin"):
            return False
        auth = self.headers.get("Authorization", "")
        return hmac.compare_digest(auth.encode(), f"Bearer {_TOKEN}".encode())

    def do_POST(self):
        import json
        if not self._authorized():
            self._send_json(403, {"error": "forbidden"})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self._send_json(415, {"error": "content-type must be application/json"})
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            self._send_json(400, {"error": "bad json"})
            return

        js_code = body.get("js", "")
        if not js_code:
            self._send_json(400, {"error": "no js"})
            return

        if self.path == "/eval":
            _fire_queue.put(js_code)
            self._send_json(200, {"result": None, "error": None})

        elif self.path == "/eval_sync":
            ev = threading.Event()
            result_box = {"result": None, "error": "timeout"}
            req_id = _next_req_id()

            js_exec = (
                "(function(){"
                "try{"
                "var __r=(function(){" + js_code + "})();"
                "return {ok:1,v:(__r===undefined?null:__r)};"
                "}catch(__e){"
                "return {ok:0,err:String(__e)};"
                "}"
                "})()"
            )

            def make_cb():
                """Factory: creates a fresh callback that resolves ev once."""
                def _cb(data):
                    with _cb_refs_lock:
                        _cb_refs.discard(_cb)
                    if ev.is_set():
                        return
                    _log(f"cb fired req={req_id} data_type={type(data).__name__} ok={data.get('ok') if isinstance(data,dict) else 'N/A'}")
                    if isinstance(data, dict) and data.get("ok") == 1:
                        result_box["result"] = data.get("v")
                        result_box["error"] = None
                        ev.set()
                    elif isinstance(data, dict) and data.get("ok") == 0:
                        result_box["result"] = None
                        result_box["error"] = data.get("err", "js error")
                        ev.set()
                    # None / unexpected → page still loading, re-dispatch will retry
                with _cb_refs_lock:
                    _cb_refs.add(_cb)
                return _cb

            # Register in _in_flight_js so _on_load_finished can re-dispatch.
            with _in_flight_lock:
                _in_flight_js[req_id] = (js_exec, make_cb)
            _log(f"eval_sync req={req_id} registered, in_flight={len(_in_flight_js)}")

            # Initial dispatch + 2s retry loop.
            deadline = time.time() + 30.0
            cb = make_cb()
            _fire_queue.put((js_exec, cb))
            _log(f"eval_sync req={req_id} initial enqueue")
            while not ev.wait(2.0) and time.time() < deadline:
                cb2 = make_cb()
                _fire_queue.put((js_exec, cb2))
                _log(f"eval_sync req={req_id} retry enqueue in_flight={len(_in_flight_js)}")

            with _in_flight_lock:
                _in_flight_js.pop(req_id, None)
            _log(f"eval_sync req={req_id} done result={result_box['result']} err={result_box['error']}")

            self._send_json(200, {"result": result_box["result"], "error": result_box["error"]})

        else:
            self._send_json(404, {"error": "not found"})

    def do_DELETE(self):
        if not self._authorized():
            self._send_json(403, {"error": "forbidden"})
            return
        if self.path == "/shutdown":
            self._send_json(200, {"result": "ok"})
            threading.Thread(target=_server.shutdown, daemon=True).start()


def _start_server():
    global _server
    _write_token()
    _server = _ThreadingServer(("127.0.0.1", PORT), _Handler)
    _server.serve_forever()


threading.Thread(target=_start_server, daemon=True).start()

_t_poll = QTimer()
_t_poll.timeout.connect(_poll)
_t_poll.start(50)
