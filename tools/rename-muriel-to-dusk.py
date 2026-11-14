#!/usr/bin/env python3
"""User-facing + identifier rebrand Muriel/Riff → Dusk (keeps WAV RIFF + github paths)."""
import os
import re
import sys

SKIP_DIRS = {
    '.git', 'node_modules', 'vendor', 'dist', 'target', 'cargo-target',
    'www', 'android', 'ios', '.claude', '.superpowers',
}
SKIP_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2',
            '.mp3', '.mp4', '.wasm', '.bin', '.lock', '.map'}
# Historical / generated docs — leave alone
SKIP_PREFIX = (
    'docs' + os.sep + 'superpowers',
    'docs' + os.sep + 'UPSTREAM',
    'tools' + os.sep + 'rename-riff.py',
    'tools' + os.sep + 'rename-muriel-to-dusk.py',
)

def protect(s: str) -> str:
    s = s.replace("writeString(0, 'RIFF')", "\x00WAVFOURCC\x00")
    s = s.replace('rIfFileNotExist', '\x00RIFNE\x00')
    s = s.replace('github.com/cloverscripts/riff-muriel', '\x00GH_RM\x00')
    s = s.replace('github.com/rootscripts/riff', '\x00GH_RIFF\x00')
    s = s.replace('riff-muriel', '\x00REPO_RM\x00')
    return s

def unprotect(s: str) -> str:
    return (s
        .replace('\x00WAVFOURCC\x00', "writeString(0, 'RIFF')")
        .replace('\x00RIFNE\x00', 'rIfFileNotExist')
        .replace('\x00GH_RM\x00', 'github.com/cloverscripts/riff-muriel')
        .replace('\x00GH_RIFF\x00', 'github.com/rootscripts/riff')
        .replace('\x00REPO_RM\x00', 'riff-muriel'))

def rename(s: str) -> str:
    s = protect(s)
    # Identifiers / prefixes first (longer forms before short)
    s = s.replace('MurielAudioEngine', 'DuskAudioEngine')
    s = s.replace('MurielMedia', 'DuskMedia')
    s = s.replace('MurielWidgets', 'DuskWidgets')
    s = s.replace('__murielFetch', '__duskFetch')
    s = s.replace('__murielPlaysOpus', '__duskPlaysOpus')
    s = s.replace('x-muriel-token', 'x-dusk-token')
    s = s.replace('.murieltutorial', '.dusktutorial')
    s = s.replace('muriel.desktop', 'dusk.desktop')
    s = s.replace('ic_stat_muriel', 'ic_stat_dusk')
    s = re.sub(r'\bMURIEL_', 'DUSK_', s)
    s = re.sub(r'\bmuriel_', 'dusk_', s)
    s = re.sub(r'\bmuriel-', 'dusk-', s)
    s = re.sub(r'\bmuriel:', 'dusk:', s)
    s = re.sub(r'\bmuriel/', 'dusk/', s)
    s = re.sub(r"'muriel'", "'dusk'", s)
    s = re.sub(r'"muriel"', '"dusk"', s)
    s = re.sub(r'\bMuriel\b', 'Dusk', s)
    s = re.sub(r'\bmuriel\b', 'dusk', s)
    # Product Riff → Dusk (not RIFF fourcc — protected)
    s = s.replace('RiffAudioEngine', 'DuskAudioEngine')
    s = re.sub(r'\bRIFF_', 'DUSK_', s)
    s = re.sub(r'\briff_', 'dusk_', s)
    s = re.sub(r'\briff-', 'dusk-', s)
    s = re.sub(r'\briff:', 'dusk:', s)
    s = re.sub(r'\bRiff\b', 'Dusk', s)
    s = re.sub(r'\briff\b', 'dusk', s)
    return unprotect(s)

def should_skip(path: str, root: str) -> bool:
    rel = os.path.relpath(path, root)
    if any(rel.startswith(p) for p in SKIP_PREFIX):
        return True
    ext = os.path.splitext(path)[1].lower()
    if ext in SKIP_EXT:
        return True
    return False

def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    changed = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            if should_skip(path, root):
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            new = rename(text)
            if new != text:
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    f.write(new)
                changed += 1
                print(os.path.relpath(path, root))
    print(f'updated {changed} files')

if __name__ == '__main__':
    main()
