"""Create editable Dusk design screens, preserving source artwork attribution."""
from base64 import b64encode
from html import escape
from itertools import count
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
BACKGROUND = '#131416'
SURFACE = '#202125'
ELEVATED = '#2B2D32'
FOREGROUND = '#F5F5F7'
SECONDARY = '#A9ABB3'
ACCENT = '#C0C5E8'
FONT = 'Inter'
IDS = count()


def box(x, y, w, h, color, radius=0, stroke=None):
    border = f' stroke="{stroke}" stroke-width="1"' if stroke else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{color}"{border}/>'


def text(x, y, content, size=14, weight=400, color=FOREGROUND, align='start', spacing=0):
    return f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{align}" letter-spacing="{spacing}">{escape(content)}</text>'


def circle(x, y, radius, color):
    return f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{color}"/>'


def icon(name, x, y, size=24, color=FOREGROUND):
    paths = {
        'settings': 'M4 7h16M4 17h16M9 4v6M15 14v6',
        'search': 'M16.5 16.5L21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
        'library': 'M4 5v15M10 5v15M16 4l4 15',
        'compass': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 8l-3 5-5 3 3-5Z',
        'heart': 'M12 20S2.5 14 2.5 8.5C2.5 3 9 2 12 7c3-5 9.5-4 9.5 1.5C21.5 14 12 20 12 20Z',
        'download': 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',
        'down': 'M5 9l7 7 7-7',
        'chevron': 'M9 5l7 7-7 7',
        'queue': 'M3 5h18M3 11h18M3 17h10M17 15l5 3-5 3Z',
        'lyrics': 'M5 3h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 8h10M7 12h7',
        'shuffle': 'M3 6h3c5 0 7 12 12 12h3M17 14l4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3M17 2l4 4-4 4',
        'repeat': 'M4 10V7h15M16 3l4 4-4 4M20 14v3H5M8 13l-4 4 4 4',
        'plus': 'M12 5v14M5 12h14',
    }
    if name == 'pause':
        body = box(5, 4, 5, 16, color, 1.5) + box(14, 4, 5, 16, color, 1.5)
    elif name == 'play':
        body = f'<path d="M7 4Q5 3 5 6v12q0 3 2 2l13-7q2-1 0-2Z" fill="{color}"/>'
    elif name in ('next', 'previous'):
        body = f'<path d="M4 5v14l12-7Z" fill="{color}"/>' + box(18, 5, 2.5, 14, color, 1)
        if name == 'previous':
            body = f'<g transform="translate(24 0) scale(-1 1)">{body}</g>'
    elif name == 'more':
        body = ''.join(circle(i, 12, 1.6, color) for i in (5, 12, 19))
    else:
        body = f'<path d="{paths[name]}" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<g transform="translate({x} {y}) scale({size/24})">{body}</g>'


def mark(x, y, size, color=FOREGROUND):
    body = f'<path d="M4 13a8 8 0 0 1 16 0M4 18h16" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round"/>'
    return f'<g transform="translate({x} {y}) scale({size/24})">{body}</g>'


def art(slug, x, y, w, h=None, radius=0):
    h = h or w
    key = f'art{next(IDS)}'
    uri = 'data:image/jpeg;base64,' + b64encode((ROOT/'assets'/f'{slug}.jpg').read_bytes()).decode('ascii')
    return (f'<defs><clipPath id="{key}">{box(x,y,w,h,"white",radius)}</clipPath></defs>'
            f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{key})" xlink:href="{uri}"/>')


def status():
    result = text(29, 29, '9:41', 13, 600)
    result += '<path d="M109 0H281v12q0 20-20 20H129q-20 0-20-20Z" fill="#050506"/>'
    for i in range(4):
        result += box(295+i*5, 27-(i+1)*3, 3, (i+1)*3, FOREGROUND, 1)
    result += '<path d="M319 18q8-7 16 0M322 22q5-4 10 0" stroke="#F5F5F7" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    result += circle(327, 26, 1.5, FOREGROUND)
    result += box(343, 16, 23, 12, 'none', 3, SECONDARY) + box(345, 18, 18, 8, FOREGROUND, 1) + box(368, 20, 2, 4, SECONDARY, 1)
    return result


def home_indicator():
    return box(132, 830, 126, 4, FOREGROUND, 2)


def shell(name, body):
    return f'<defs><clipPath id="clip-{name}">' + box(0, 0, 390, 844, 'white', 38) + f'</clipPath></defs><g id="{name}" clip-path="url(#clip-{name})">' + box(0, 0, 390, 844, BACKGROUND, 38) + status() + body + home_indicator() + '</g>'


def home():
    body = mark(22, 66, 24) + text(55, 86, 'Dusk', 20, 600, spacing=-.5)
    body += box(326, 54, 44, 44, SURFACE, 16) + icon('settings', 337, 65, 22)
    for x,w,label,active in [(20,94,'Für dich',True),(124,64,'Neu',False),(198,81,'Mixes',False)]:
        body += box(x, 116, w, 36, FOREGROUND if active else SURFACE, 18)
        body += text(x+w/2, 139, label, 12, 500, BACKGROUND if active else SECONDARY, 'middle')

    # A solid caption panel preserves contrast without a decorative gradient.
    body += art('after-hours', 20, 171, 350, 248, 22)
    body += '<path d="M20 402H370V462Q370 484 348 484H42Q20 484 20 462Z" fill="#202125"/>'
    body += box(34, 185, 113, 29, '#202125', 14)
    body += text(90.5, 204, 'Dein Abendmix', 11, 500, FOREGROUND, 'middle')
    body += text(37, 437, 'After dark', 26, 600, spacing=-0.8)
    body += text(37, 462, 'The Weeknd, Travis Scott & mehr', 12, color=SECONDARY)
    body += circle(332, 441, 25, FOREGROUND) + icon('play', 322, 430, 22, BACKGROUND)

    body += text(20, 526, 'Zuletzt gehört', 18, 600, spacing=-0.4)
    body += text(366, 524, 'Alle', 11, 400, SECONDARY, 'end')
    for y,slug,title,artist in [(544,'utopia','UTOPIA','Travis Scott'),(610,'hit-me-hard-and-soft','HIT ME HARD AND SOFT','Billie Eilish')]:
        body += art(slug, 20, y, 52, radius=10)
        body += text(85, y+21, title, 13 if len(title)>17 else 14, 500)
        body += text(85, y+42, artist, 12, color=SECONDARY)
        body += icon('more', 342, y+15, 22, SECONDARY)

    body += box(12, 687, 366, 67, ELEVATED, 20)
    body += art('after-hours', 23, 698, 44, radius=9)
    body += text(80, 716, 'After Hours', 14, 500) + text(80, 736, 'The Weeknd', 12, color=SECONDARY)
    body += icon('pause', 291, 708, 22) + icon('next', 338, 708, 22)
    body += box(31, 750, 328, 2, '#51535C', 1) + box(31, 750, 93, 2, ACCENT, 1)
    for center,label,name,active in [(71,'Entdecken','compass',True),(195,'Sammlung','library',False),(319,'Suche','search',False)]:
        if active:
            body += box(center-29, 765, 58, 32, '#363943', 16)
        body += icon(name, center-11, 770, 22, FOREGROUND if active else SECONDARY)
        body += text(center, 814, label, 11, 500, FOREGROUND if active else SECONDARY, 'middle')
    return shell('Dusk-Entdecken', body)


def player():
    body = icon('down', 25, 62, 24) + icon('more', 341, 62, 24)
    body += text(195, 69, 'After dark', 13, 500, align='middle')
    body += text(195, 89, 'Dein Abendmix', 12, color=SECONDARY, align='middle')
    body += art('after-hours', 24, 122, 342, radius=22)
    body += text(24, 506, 'After Hours', 28, 600, spacing=-1)
    body += text(24, 534, 'The Weeknd', 15, color=SECONDARY)
    body += circle(346, 507, 22, SURFACE) + icon('heart', 335, 496, 22, ACCENT)
    body += box(24, 555, 155, 34, SURFACE, 17)
    body += icon('download', 36, 564, 16, SECONDARY) + text(61, 577, 'Offline speichern', 11.5, 500, SECONDARY)
    body += box(24, 615, 342, 4, '#44464D', 2) + box(24, 615, 97, 4, FOREGROUND, 2) + circle(121, 617, 5, FOREGROUND)
    body += text(24, 643, '1:42', 11, color=SECONDARY) + text(366, 643, '6:01', 11, color=SECONDARY, align='end')
    body += icon('shuffle', 26, 687, 22, SECONDARY) + icon('previous', 97, 684, 28)
    body += box(153, 665, 84, 64, FOREGROUND, 26) + icon('pause', 182, 684, 26, BACKGROUND)
    body += icon('next', 266, 684, 28) + icon('repeat', 340, 687, 22, SECONDARY)
    body += box(24, 759, 164, 48, SURFACE, 16) + icon('lyrics', 48, 773, 19, SECONDARY)
    body += text(79, 789, 'Lyrics', 12, 500)
    body += box(202, 759, 164, 48, SURFACE, 16) + icon('queue', 218, 773, 19, SECONDARY)
    body += text(247, 789, 'Warteschlange', 11.5, 500)
    return shell('Dusk-Player', body)


def svg(content, width, height):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{content}</svg>'


def main():
    first,second = home(),player()
    (ROOT/'dusk-home.svg').write_text(svg(first,390,844))
    (ROOT/'dusk-player.svg').write_text(svg(second,390,844))
    board = box(0,0,1440,1080,'#1B1C20')
    board += mark(64,133,32) + text(110,163,'Dusk',38,600,spacing=-1)
    board += text(64,235,'Startseite & Player',23,500,spacing=-.5)
    board += text(64,272,'Für iPhone 14.',16,color=SECONDARY)
    board += text(64,358,'Dunkle, ruhige Flächen.',16,color=FOREGROUND)
    board += text(64,387,'Große Cover. Kurze Wege.',16,color=FOREGROUND)
    board += text(64,416,'Ein eigener Charakter.',16,color=FOREGROUND)
    for i,(c,label) in enumerate([(BACKGROUND,'Graphit'),(FOREGROUND,'Weiß'),(ACCENT,'Kühler Akzent')]):
        board += circle(76,516+i*49,12,c) + text(103,522+i*49,label,13,color=SECONDARY)
    board += box(64,710,80,80,BACKGROUND,22) + mark(83,729,42)
    board += text(64,831,'Inter / iOS System',15,500)
    board += text(64,857,'390 × 844 pt',13,color=SECONDARY)
    board += text(496,90,'Entdecken',14,500,color=SECONDARY)
    board += text(946,90,'Player',14,500,color=SECONDARY)
    board += f'<g transform="translate(496 116)">{first}</g><g transform="translate(946 116)">{second}</g>'
    board += text(496,1009,'Dusk / Designentwurf',12,color=SECONDARY)
    board += text(496,1034,'Beispielauswahl. Wiedergabe und Download sind hier nicht interaktiv.',11,color=SECONDARY)
    (ROOT/'dusk-board.svg').write_text(svg(board,1440,1080))
    for name in ['dusk-home','dusk-player','dusk-board']:
        subprocess.run(['convert','-background','#1B1C20',str(ROOT/(name+'.svg')),str(ROOT/(name+'.png'))],check=True)
    print(ROOT/'dusk-board.png')


if __name__ == '__main__':
    main()
