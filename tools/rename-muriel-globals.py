#!/usr/bin/env python3
"""Second pass: MurielFoo / RiffFoo globals → DuskFoo. Keep Capacitor plugin IDs that match native."""
import os
import re
import sys

SKIP_DIRS = {
    '.git', 'node_modules', 'vendor', 'dist', 'target', 'cargo-target',
    'www', 'android', 'ios',
}

# Longer first
REPLACEMENTS = [
    ('MurielLiveActivity', 'DuskLiveActivity'),
    ('MurielBackground', 'DuskBackground'),
    ('MurielSettingsBack', 'DuskSettingsBack'),
    ('MurielAudioEngine', 'DuskAudioEngine'),
    ('MurielProfiles', 'DuskProfiles'),
    ('MurielIsland', 'DuskIsland'),
    ('MurielEncore', 'DuskEncore'),
    ('MurielShare', 'DuskShare'),
    ('MurielCache', 'DuskCache'),
    ('MurielCore', 'DuskCore'),
    ('MurielI18n', 'DuskI18n'),
    ('MurielLog', 'DuskLog'),
    ('MurielMedia', 'DuskMedia'),
    ('isRiffAccount', 'isLegacyAccount'),
    ('__riffFetchPatched', '__duskFetchPatched'),
    ('__murielStreamPlayback', '__duskStreamPlayback'),
    ('__murielFetch', '__duskFetch'),
    ('__murielPlaysOpus', '__duskPlaysOpus'),
    ('riffFont', 'duskFont'),
]

# Capacitor / native bridge IDs — restore after rename so mobile plugins still resolve
PLUGIN_ALIASES = [
    # registerPlugin('DuskLiveActivity') must stay MurielLiveActivity until native is renamed
    ("registerPlugin('DuskLiveActivity')", "registerPlugin('MurielLiveActivity')"),
    ('registerPlugin("DuskLiveActivity")', 'registerPlugin("MurielLiveActivity")'),
    ("registerPlugin('DuskMedia')", "registerPlugin('MurielMedia')"),
    ('registerPlugin("DuskMedia")', 'registerPlugin("MurielMedia")'),
    ("name = \"DuskMedia\"", "name = \"MurielMedia\""),  # if any java leaked
]

def process(text: str) -> str:
    for a, b in REPLACEMENTS:
        text = text.replace(a, b)
    for a, b in PLUGIN_ALIASES:
        text = text.replace(a, b)
    return text

def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    n = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            if not name.endswith(('.js', '.html', '.mjs', '.css', '.json', '.md', '.txt', '.yml', '.swift', '.java', '.xml', '.gradle', '.ts')):
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            new = process(text)
            if new != text:
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    f.write(new)
                n += 1
                print(os.path.relpath(path, root))
    print(f'updated {n} files')

if __name__ == '__main__':
    main()
