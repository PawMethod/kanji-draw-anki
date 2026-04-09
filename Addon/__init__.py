"""Kanji Draw Persistence – persist template settings across Anki Desktop restarts.

Anki Desktop uses QWebEngineProfile() without a storage name, creating an
off-the-record profile that wipes all web storage (cookies, localStorage,
IndexedDB) on every restart.

This add-on works around that limitation:
  1. Intercepts pycmd('kdp:{...}') calls from the card templates
  2. Saves the settings dict to a JSON file in user_files/
  3. On every card render, injects a <script> that restores the settings
     into both window._ks and localStorage before any template code runs

The templates work fine without this add-on (settings just reset on restart).
"""

import json
import logging
import os
import threading

from aqt import gui_hooks

_log = logging.getLogger(__name__)

_SETTINGS_FILE = os.path.join(
    os.path.dirname(__file__), "user_files", "settings.json"
)
_settings_cache = None
_lock = threading.Lock()


def _load():
    """Load persisted settings from disk (cached in-memory)."""
    global _settings_cache
    with _lock:
        if _settings_cache is not None:
            return _settings_cache
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                _settings_cache = json.load(f)
                return _settings_cache
        except FileNotFoundError:
            _settings_cache = {}
            return _settings_cache
        except (json.JSONDecodeError, OSError) as e:
            _log.warning("Failed to load settings: %s", e)
            return {}


def _save(data):
    """Write settings dict to disk atomically and update cache."""
    global _settings_cache
    tmp = _SETTINGS_FILE + ".tmp"
    with _lock:
        try:
            os.makedirs(os.path.dirname(_SETTINGS_FILE), exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            os.replace(tmp, _SETTINGS_FILE)
            _settings_cache = data
        except (OSError, TypeError) as e:
            _log.warning("Failed to save settings: %s", e)
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _on_js_message(handled, message, context):
    """Intercept pycmd('kdp:{...}') from card templates."""
    if not isinstance(message, str) or not message.startswith("kdp:"):
        return handled
    try:
        data = json.loads(message[4:])
        if isinstance(data, dict):
            _save(data)
    except (json.JSONDecodeError, TypeError) as e:
        _log.debug("Malformed kdp message: %s", e)
    return (True, None)


def _on_card_will_show(text, card, kind):
    """Inject saved settings before template scripts run."""
    settings = _load()
    # Always inject sentinel so templates can detect that the addon is present.
    # Also restore persisted settings into window._ks and localStorage when available.
    inject = "<script>(function(){window._kanjiAddonLoaded=1;"
    if settings:
        # json.dumps can produce </script> inside string values, which would close
        # the injected <script> tag prematurely. Replace </ with <\/ to neutralise.
        js = json.dumps(settings, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        inject += (
            "var d=" + js + ";"
            "if(!window._ks)window._ks=d;"
            "else{for(var k in d)if(window._ks[k]===void 0)window._ks[k]=d[k]}"
            "try{for(var k in d)if(localStorage.getItem(k)===null)"
            "localStorage.setItem(k,d[k])}catch(e){}"
        )
    inject += "})()</script>"
    return inject + text


gui_hooks.webview_did_receive_js_message.append(_on_js_message)
gui_hooks.card_will_show.append(_on_card_will_show)
