#!/usr/bin/env python3
"""Builds index.html, the whole game in one offline file, from its sources.

  src/page.html     the page around the game (head, style, canvas); //@@GAME@@ marks where the code goes
  src/game/*.js     the game code, joined in file-name order inside page.html's script (one shared scope,
                    so a file is a slice of one program, not a module)
  sounds/sfx.txt    the sound sets in the order they're decoded (gunshots first)
  sounds/sfx/<set>/NN.mp3   every take, embedded as base64 where src/game/22-sound.js says //@@SOUNDS@@
  sounds/ir.txt, sounds/ir/<room>.mp3   the room impulse responses

  python3 build.py           write index.html
  python3 build.py --check   exit 1 if index.html isn't what the sources build (run before every commit)

Standard library only: no packages to install.
"""
import base64
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(*p, mode='r'):
    with open(os.path.join(ROOT, *p), mode) as f:
        return f.read()


def b64(*p):
    return base64.b64encode(read(*p, mode='rb')).decode()


def lines(*p):
    return [l for l in read(*p).split('\n') if l.strip()]


def sounds():
    out = ['const SFX_MP3 = {']
    for key in lines('sounds', 'sfx.txt'):
        takes = sorted(f for f in os.listdir(os.path.join(ROOT, 'sounds', 'sfx', key)) if f.endswith('.mp3'))
        out += [f'  {key}: ['] + [f"    '{b64('sounds', 'sfx', key, f)}'," for f in takes] + ['  ],']
    out += ['};', 'const IR_MP3 = {']
    out += [f"  {key}: '{b64('sounds', 'ir', key + '.mp3')}'," for key in lines('sounds', 'ir.txt')]
    out += ['};']
    return '\n'.join(out) + '\n'


def build():
    files = sorted(f for f in os.listdir(os.path.join(ROOT, 'src', 'game')) if f.endswith('.js'))
    game = ''.join(read('src', 'game', f) for f in files)
    assert game.count('//@@SOUNDS@@\n') == 1, 'one //@@SOUNDS@@ line expected in src/game'
    game = game.replace('//@@SOUNDS@@\n', sounds())
    page = read('src', 'page.html')
    assert page.count('//@@GAME@@\n') == 1, 'one //@@GAME@@ line expected in src/page.html'
    return page.replace('//@@GAME@@\n', game)


if __name__ == '__main__':
    html = build()
    out = os.path.join(ROOT, 'index.html')
    if '--check' in sys.argv:
        same = os.path.exists(out) and read('index.html') == html
        print('index.html is up to date' if same else 'index.html is OUT OF DATE: run python3 build.py')
        sys.exit(0 if same else 1)
    with open(out, 'w') as f:
        f.write(html)
    print('built index.html: %d KB, %d lines' % (len(html) // 1024, html.count('\n')))
