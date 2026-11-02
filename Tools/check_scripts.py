#!/usr/bin/env python3
"""Syntax-check every inline <script> of the card templates with node --check."""
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
bad = 0
for f in sorted((ROOT / 'Templates').glob('Card-*/*.html')):
    text = f.read_text(encoding='utf-8')
    for i, m in enumerate(re.finditer(r'<script(?![^>]*type="text/plain")[^>]*>(.*?)</script>', text, re.S)):
        code = re.sub(r'\{\{[^}]*\}\}', '0', m.group(1))
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as tmp:
            tmp.write(code)
        r = subprocess.run(['node', '--check', tmp.name], capture_output=True, text=True)
        if r.returncode:
            bad += 1
            line = text[:m.start()].count('\n') + 1
            print(f'{f.relative_to(ROOT)} script #{i} (line {line}):\n{r.stderr.strip()[:400]}')
print('SYNTAX-OK' if not bad else f'{bad} script(s) with errors')
sys.exit(1 if bad else 0)
