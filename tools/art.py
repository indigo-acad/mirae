# Генератор рисунков для языковых разделов MIRAÉ: пейзажи, ленты, эмблемы и угловые орнаменты.
# Запуск из корня сайта: python3 tools/art.py        (пишет SVG в img/)
# Цвета взяты из палитры школы: индиго и золото. Рисунки можно править руками или заменить своими:
# сайт берёт их из img/ по именам scene-*, band-*, emblem-*, corner-* (см. css/style.css, блок «языковые разделы»).
import math, random, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else 'img'
GOLD = '#D4AF7C'; GOLD_HI = '#E6CDA3'; LAMP = '#F3C677'
FAR = '#17256B'; MID = '#0D194A'; NEAR = '#070C26'; DEEP = '#050818'


def f(x):
    return ('%.1f' % x).rstrip('0').rstrip('.')


def svg(w, h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" {extra}>{body}</svg>\n'


def smooth(pts, close=True):
    """Сглаженный контур через середины отрезков (квадратичные кривые)."""
    d = 'M%s %s' % (f(pts[0][0]), f(pts[0][1]))
    for i in range(1, len(pts) - 1):
        mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
        d += 'Q%s %s %s %s' % (f(pts[i][0]), f(pts[i][1]), f(mx), f(my))
    d += 'L%s %s' % (f(pts[-1][0]), f(pts[-1][1]))
    return d + ('Z' if close else '')


def fade(w, h, body, edge=.11):
    """Оборачивает рисунок в маску: края растворяются, поэтому на странице нет резких границ."""
    e = f(edge)
    defs = (f'<linearGradient id="fx" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/>'
            f'<stop offset="{e}" stop-color="#fff"/><stop offset="{f(1-edge)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
            f'<mask id="mx" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="url(#fx)"/></mask>')
    return defs, f'<g mask="url(#mx)">{body}</g>'


# ============================== КОРЕЙСКИЙ ==============================
# Пять вершин (по мотивам «Ирвор обондо»), «облака сун», сосны, беседка, волны «чхонхэ».

def peak(cx, w, h, base=300, sk=0.0):
    """Крутая вершина со ступенчатыми плечами; sk — небольшой наклон."""
    pts = [(-.5, 0), (-.40, .22), (-.34, .30), (-.28, .52), (-.21, .60), (-.15, .82), (-.07, .93), (0, 1.0),
           (.07, .94), (.14, .80), (.22, .62), (.27, .50), (.35, .28), (.41, .20), (.5, 0)]
    return [(cx + (x + sk * y) * w, base - y * h) for x, y in pts]


def inner(pts, cx, base, k):
    return [(cx + (x - cx) * k, base - (base - y) * k) for x, y in pts]


def cloud(x, y, s=1.0, o=.6, flip=1):
    """Облако «сун»: завиток слева, волнистая шапка и хвост справа, только контур."""
    def p(dx, dy):
        return f'{f(x + flip * dx * s)} {f(y + dy * s)}'
    d = (f'M{p(0,22)}C{p(-8,10)} {p(6,0)} {p(16,7)}C{p(18,-5)} {p(36,-6)} {p(42,5)}C{p(52,-1)} {p(66,6)} {p(62,16)}'
         f'C{p(72,14)} {p(78,24)} {p(68,29)}L{p(8,29)}C{p(-6,29)} {p(-9,25)} {p(0,22)}Z')
    d += f'M{p(18,17)}C{p(15,10)} {p(26,8)} {p(28,15)}C{p(29,21)} {p(21,22)} {p(21,18)}'
    d += f'M{p(68,24)}C{p(88,26)} {p(98,16)} {p(116,21)}C{p(124,23)} {p(130,19)} {p(136,21)}'
    return f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="{o}"/>'


def pine(x, base, s=1.0, flip=1):
    """Сосна: изогнутый ствол и ярусы плоской хвои с золотой кромкой."""
    t = (f'<path d="M{f(x)} {f(base)}C{f(x+flip*12*s)} {f(base-40*s)} {f(x-flip*16*s)} {f(base-72*s)} {f(x+flip*6*s)} {f(base-118*s)}" '
         f'fill="none" stroke="{DEEP}" stroke-width="{f(7.5*s)}" stroke-linecap="round"/>')
    t += (f'<path d="M{f(x+flip*0*s)} {f(base-66*s)}Q{f(x+flip*28*s)} {f(base-74*s)} {f(x+flip*52*s)} {f(base-96*s)}" '
          f'fill="none" stroke="{DEEP}" stroke-width="{f(4.4*s)}" stroke-linecap="round"/>')
    t += (f'<path d="M{f(x-flip*2*s)} {f(base-84*s)}Q{f(x-flip*26*s)} {f(base-88*s)} {f(x-flip*46*s)} {f(base-108*s)}" '
          f'fill="none" stroke="{DEEP}" stroke-width="{f(3.6*s)}" stroke-linecap="round"/>')
    for dx, dy, rx, ry in [(6, -128, 48, 12), (-30, -108, 36, 9.5), (54, -100, 34, 9), (14, -150, 32, 9.5), (-48, -128, 26, 7.5)]:
        cx, cy = x + flip * dx * s, base + dy * s
        t += f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx*s)}" ry="{f(ry*s)}" fill="{DEEP}"/>'
        t += (f'<path d="M{f(cx-rx*s*.92)} {f(cy-ry*s*.3)}Q{f(cx)} {f(cy-ry*s*1.7)} {f(cx+rx*s*.92)} {f(cy-ry*s*.3)}" '
              f'fill="none" stroke="{GOLD}" stroke-width=".9" opacity=".55"/>')
    return t


def pavilion(x, base, s=1.0):
    """Беседка: двухъярусная изогнутая крыша, колонны, помост и тёплые фонари."""
    def r(dx, dy):
        return f'{f(x + dx * s)} {f(base + dy * s)}'
    t = ''
    for k, (w0, y0, up) in enumerate([(66, -62, 0), (50, -88, 0)]):
        d = (f'M{r(-w0,y0)}Q{r(-w0*.7,y0+2)} {r(-w0*.42,y0-14)}Q{r(0,y0-34)} {r(w0*.42,y0-14)}Q{r(w0*.7,y0+2)} {r(w0,y0)}'
             f'Q{r(w0*.82,y0+6)} {r(w0*.7,y0+8)}L{r(-w0*.7,y0+8)}Q{r(-w0*.82,y0+6)} {r(-w0,y0)}Z')
        t += f'<path d="{d}" fill="{DEEP}"/>'
        t += (f'<path d="M{r(-w0,y0)}Q{r(-w0*.7,y0+2)} {r(-w0*.42,y0-14)}Q{r(0,y0-34)} {r(w0*.42,y0-14)}Q{r(w0*.7,y0+2)} {r(w0,y0)}" '
              f'fill="none" stroke="{GOLD}" stroke-width="1.1" opacity=".8"/>')
    t += f'<rect x="{f(x-6*s)}" y="{f(base-96*s)}" width="{f(12*s)}" height="{f(10*s)}" fill="{DEEP}"/>'
    for dx in (-44, -26, -9, 9, 26, 44):
        t += f'<rect x="{f(x+dx*s-2*s)}" y="{f(base-54*s)}" width="{f(4*s)}" height="{f(46*s)}" fill="{DEEP}"/>'
    t += f'<rect x="{f(x-56*s)}" y="{f(base-9*s)}" width="{f(112*s)}" height="{f(9*s)}" rx="2" fill="{DEEP}"/>'
    t += f'<rect x="{f(x-66*s)}" y="{f(base-2*s)}" width="{f(132*s)}" height="{f(4*s)}" rx="2" fill="{DEEP}"/>'
    for dx in (-60, 60):
        t += f'<circle cx="{f(x+dx*s)}" cy="{f(base-54*s)}" r="{f(2.6*s)}" fill="{LAMP}" opacity=".95"/>'
        t += f'<circle cx="{f(x+dx*s)}" cy="{f(base-54*s)}" r="{f(10*s)}" fill="url(#glow)" opacity=".7"/>'
    return t


def waves(y0, rows=3, R=20, op=.45):
    """Волны «чхонхэ»: чешуя из вложенных дуг, ряды сдвинуты на полшага и перекрывают друг друга."""
    t = ''
    step = R * 2
    for r in range(rows):
        y = y0 + r * R * .5 + R * .5
        off = 0 if r % 2 == 0 else R
        d = ''
        x = -R * 2 + off
        while x < 1700:
            cx = x
            t += f'<path d="M{f(cx-R)} {f(y)}A{R} {R} 0 0 1 {f(cx+R)} {f(y)}Z" fill="{NEAR}"/>'
            for rr in (R, R * .7, R * .4):
                d += f'M{f(cx-rr)} {f(y)}A{f(rr)} {f(rr)} 0 0 1 {f(cx+rr)} {f(y)}'
            x += step
        t += f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width=".9" opacity="{f(op - r * .08)}"/>'
    return t


def scene_ko():
    W, H = 1600, 300
    defs = (f'<linearGradient id="pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22338A"/><stop offset="1" stop-color="#0E1A52"/></linearGradient>'
            f'<linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GOLD}" stop-opacity=".95"/><stop offset="1" stop-color="{GOLD}" stop-opacity=".12"/></linearGradient>'
            f'<radialGradient id="mist"><stop offset="0" stop-color="#8FA2F2" stop-opacity=".30"/><stop offset="1" stop-color="#8FA2F2" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="glow"><stop offset="0" stop-color="#FFE3A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE3A0" stop-opacity="0"/></radialGradient>')
    b = ''
    # дальний хребет
    far = [(0, 214), (90, 190), (190, 176), (290, 196), (390, 170), (470, 150), (560, 176), (640, 140), (720, 120), (800, 112), (880, 124),
           (960, 138), (1050, 118), (1140, 150), (1230, 168), (1320, 150), (1410, 184), (1500, 170), (1600, 200), (1600, 300), (0, 300)]
    b += f'<path d="{smooth(far)}" fill="{FAR}" opacity=".55"/>'
    b += f'<path d="{smooth(far[:-2], False)}" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".28"/>'
    # облака «сун» на дальнем плане
    for x, y, s, o, fl in [(60, 34, 1.05, .6, 1), (300, 96, .62, .45, 1), (1180, 52, .8, .55, -1), (1360, 20, 1.15, .62, 1), (1486, 112, .6, .42, -1), (620, 22, .6, .4, 1)]:
        b += cloud(x, y, s, o, fl)
    # пять вершин
    for cx, w, h, sk in [(455, 250, 150, -.05), (635, 272, 208, .03), (800, 304, 266, 0), (968, 270, 202, -.03), (1146, 250, 150, .05)]:
        p = peak(cx, w, h, 300, sk)
        b += f'<path d="{smooth(p)}" fill="url(#pk)"/>'
        b += f'<path d="{smooth(p, False)}" fill="none" stroke="url(#gs)" stroke-width="1.5" stroke-linejoin="round"/>'
        for k, o in ((.80, .36), (.60, .26), (.40, .16)):
            b += f'<path d="{smooth(inner(p, cx, 300, k), False)}" fill="none" stroke="{GOLD}" stroke-width="1" opacity="{o}"/>'
    # дымка между хребтами
    for cx, cy, rx, ry in [(560, 262, 300, 26), (1050, 266, 320, 24), (800, 280, 420, 20)]:
        b += f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#mist)"/>'
    # ближние холмы
    hill = 'M0 300V238Q150 198 300 234T560 252Q720 270 860 254T1150 248Q1320 214 1460 238T1600 230V300Z'
    b += f'<path d="{hill}" fill="{MID}"/>'
    b += f'<path d="M0 238Q150 198 300 234T560 252Q720 270 860 254T1150 248Q1320 214 1460 238T1600 230" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".45"/>'
    b += pine(1196, 252, .55, -1) + pavilion(1318, 250, .95) + pine(1486, 258, 1.1, -1) + pine(156, 266, 1.3, 1) + pine(268, 258, .6, 1)
    b += waves(268, 3, 20, .42)
    b += f'<rect x="0" y="292" width="{W}" height="8" fill="{NEAR}"/>'
    d2, g = fade(W, H, b)
    return svg(W, H, f'<defs>{defs}{d2}</defs>{g}', 'preserveAspectRatio="xMidYMax slice"')


# ============================== АНГЛИЙСКИЙ ==============================
# Ночной город у реки: башня с часами, парламент, разводной мост, купол вдали, капелла колледжа,
# фонари с тёплым светом, отражения в воде и розы на набережной.

BD = 'url(#bd)'          # камень зданий: светлее вверху, чтобы силуэт читался на ночном небе
EDGE = '#3A4A9C'         # холодный блик на гранях


def gl(d, o=.6, w=1.0):
    return f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width="{f(w)}" opacity="{f(o)}" stroke-linecap="round" stroke-linejoin="round"/>'


def win(x, y1, w, h, lit=True, mull=True):
    """Стрельчатое окно: x — середина, y1 — низ, h — высота до начала дуги."""
    y2 = y1 - h
    d = (f'M{f(x-w/2)} {f(y1)}V{f(y2)}Q{f(x-w/2)} {f(y2-w*.7)} {f(x)} {f(y2-w)}'
         f'Q{f(x+w/2)} {f(y2-w*.7)} {f(x+w/2)} {f(y2)}V{f(y1)}Z')
    t = f'<path d="{d}" fill="{DEEP}"/>'
    if lit:
        t += f'<path d="{d}" fill="url(#wn)"/>'
    if mull and w >= 8:
        t += f'<path d="M{f(x)} {f(y1)}V{f(y2-w*.8)}M{f(x-w/2)} {f(y2+h*.42)}H{f(x+w/2)}" stroke="{NEAR}" stroke-width="{f(max(.9, w*.09))}" fill="none"/>'
    return t


def pinnacle(x, base, w, h):
    t = f'<path d="M{f(x-w/2)} {f(base)}L{f(x)} {f(base-h)}L{f(x+w/2)} {f(base)}Z" fill="{BD}"/>'
    t += gl(f'M{f(x)} {f(base-h)}L{f(x-w/2)} {f(base)}', .7)
    t += f'<circle cx="{f(x)}" cy="{f(base-h-1.5)}" r="1.5" fill="{GOLD}"/>'
    return t


def turret(x, base, w, h):
    """Угловая башенка с луковичной шапкой и шпилем."""
    top = base - h
    t = f'<rect x="{f(x-w/2)}" y="{f(top)}" width="{f(w)}" height="{f(h)}" fill="{BD}"/>'
    t += f'<path d="M{f(x-w/2)} {f(top)}V{f(base)}" stroke="{EDGE}" stroke-width="1.2" opacity=".8"/>'
    t += f'<path d="M{f(x-w/2-1.5)} {f(top+w*.9)}H{f(x+w/2+1.5)}M{f(x-w/2-1.5)} {f(top)}H{f(x+w/2+1.5)}" stroke="{NEAR}" stroke-width="2"/>'
    cap = (f'M{f(x-w/2-1)} {f(top)}Q{f(x-w/2-1)} {f(top-w*.8)} {f(x)} {f(top-w*1.7)}'
           f'Q{f(x+w/2+1)} {f(top-w*.8)} {f(x+w/2+1)} {f(top)}Z')
    t += f'<path d="{cap}" fill="{BD}"/>'
    t += gl(f'M{f(x-w/2-1)} {f(top)}Q{f(x-w/2-1)} {f(top-w*.8)} {f(x)} {f(top-w*1.7)}V{f(top-w*1.7-6)}', .8)
    t += f'<circle cx="{f(x)}" cy="{f(top-w*1.7-7)}" r="1.5" fill="{GOLD}"/>'
    return t


def battlement(x0, x1, y, o=1):
    return f'<path d="M{f(x0)} {f(y-2)}H{f(x1)}" stroke="#222F78" stroke-width="4" stroke-dasharray="5 4" opacity="{o}"/>'


def chapel(x, base, n=7, bay=34):
    """Капелла колледжа: зал с высокими стрельчатыми окнами, контрфорсы с пинаклями и башенки по углам."""
    L = n * bay + 32; hh = 90
    t = battlement(x, x + L, base - hh)
    t += f'<rect x="{f(x)}" y="{f(base-hh)}" width="{f(L)}" height="{hh}" fill="{BD}"/>'
    t += gl(f'M{f(x)} {f(base-hh)}H{f(x+L)}', .75, 1.1) + gl(f'M{f(x)} {f(base-13)}H{f(x+L)}', .25)
    for i in range(n):
        t += win(x + 16 + bay * (i + .5), base - 16, 17, 44, True)
    for i in range(n + 1):
        bx = x + 16 + bay * i
        t += f'<rect x="{f(bx-3)}" y="{f(base-hh-4)}" width="6" height="{hh+4}" fill="#1A2767"/>'
        t += f'<path d="M{f(bx-3)} {f(base-hh-4)}V{f(base)}" stroke="{EDGE}" stroke-width="1" opacity=".7"/>'
        t += pinnacle(bx, base - hh - 4, 8, 24)
    for tx in (x + 4, x + L - 4):
        t += turret(tx, base, 17, hh + 30)
    return t


def clock_tower(x, base):
    """Башня с часами: ствол, ярус циферблата, шатёр с фонарём и шпиль."""
    w = 30; sh = 112; st = 38; t = ''
    y = base - sh
    t += f'<rect x="{f(x-w/2)}" y="{f(y)}" width="{w}" height="{sh}" fill="{BD}"/>'
    for dx in (-w / 2, -5, 5):
        t += f'<path d="M{f(x+dx)} {f(y)}V{f(base)}" stroke="{EDGE}" stroke-width="1" opacity="{".8" if dx < -6 else ".35"}"/>'
    for k in range(4):
        t += win(x, base - 12 - k * 25, 5, 9, True, False)
    # ярус циферблата
    t += f'<rect x="{f(x-w/2-4)}" y="{f(y-st)}" width="{w+8}" height="{st}" fill="{BD}"/>'
    t += gl(f'M{f(x-w/2-5)} {f(y)}H{f(x+w/2+5)}M{f(x-w/2-5)} {f(y-st)}H{f(x+w/2+5)}', .7)
    cy = y - st / 2
    t += f'<circle cx="{f(x)}" cy="{f(cy)}" r="26" fill="url(#lg)" opacity=".7"/>'
    t += f'<circle cx="{f(x)}" cy="{f(cy)}" r="13.5" fill="#F6DFA6"/><circle cx="{f(x)}" cy="{f(cy)}" r="13.5" fill="none" stroke="{GOLD}" stroke-width="1.6"/>'
    t += f'<circle cx="{f(x)}" cy="{f(cy)}" r="10.3" fill="none" stroke="#8A6A3C" stroke-width=".7" stroke-dasharray="1 4.39"/>'
    t += f'<path d="M{f(x)} {f(cy)}V{f(cy-8.5)}M{f(x)} {f(cy)}L{f(x+5.5)} {f(cy+3)}" stroke="{NEAR}" stroke-width="1.6" stroke-linecap="round"/>'
    # шатёр, фонарь, шпиль
    y2 = y - st
    t += f'<path d="M{f(x-w/2-5)} {f(y2)}L{f(x-11)} {f(y2-20)}H{f(x+11)}L{f(x+w/2+5)} {f(y2)}Z" fill="{BD}"/>'
    t += gl(f'M{f(x-w/2-5)} {f(y2)}L{f(x-11)} {f(y2-20)}', .7)
    t += f'<rect x="{f(x-11)}" y="{f(y2-29)}" width="22" height="9" fill="{BD}"/>'
    for dx in (-6, 0, 6):
        t += f'<rect x="{f(x+dx-1.3)}" y="{f(y2-27)}" width="2.6" height="5.5" fill="{LAMP}" opacity=".9"/>'
    t += f'<path d="M{f(x-13)} {f(y2-29)}L{f(x)} {f(y2-64)}L{f(x+13)} {f(y2-29)}Z" fill="{BD}"/>'
    t += gl(f'M{f(x-13)} {f(y2-29)}L{f(x)} {f(y2-64)}V{f(y2-72)}', .8)
    t += f'<circle cx="{f(x)}" cy="{f(y2-73)}" r="1.7" fill="{GOLD}"/>'
    for dx in (-w / 2 - 3, w / 2 + 3):
        t += pinnacle(x + dx, y2, 6, 16)
    return t


def parliament(x0, x1, base):
    """Длинный дворец у воды: ряды окон, зубцы, пинакли и квадратная башня."""
    hh = 54; t = battlement(x0, x1, base - hh)
    t += f'<rect x="{f(x0)}" y="{f(base-hh)}" width="{f(x1-x0)}" height="{hh}" fill="{BD}"/>'
    t += gl(f'M{f(x0)} {f(base-hh)}H{f(x1)}', .6)
    n = int((x1 - x0) / 13)
    for i in range(n):
        wx = x0 + 8 + i * (x1 - x0 - 16) / (n - 1)
        for row, o in ((base - 34, .85), (base - 14, .6)):
            if (i * 7 + row) % 5 != 0:
                t += f'<rect x="{f(wx-1.6)}" y="{f(row-7)}" width="3.2" height="8" rx="1.6" fill="{LAMP}" opacity="{o}"/>'
        if i % 3 == 1:
            t += pinnacle(wx + 6, base - hh - 2, 6, 20)
    # квадратная башня
    tw = 38; tx = x1 - tw - 6; th = 112
    t += f'<rect x="{f(tx)}" y="{f(base-th)}" width="{tw}" height="{th}" fill="{BD}"/>'
    t += f'<path d="M{f(tx)} {f(base-th)}V{f(base)}" stroke="{EDGE}" stroke-width="1.2" opacity=".8"/>'
    t += battlement(tx, tx + tw, base - th) + gl(f'M{f(tx)} {f(base-th)}H{f(tx+tw)}', .7)
    for k in range(3):
        for dx in (11, 27):
            t += win(tx + dx, base - 18 - k * 30, 7, 13, k != 1 or dx == 11, False)
    for dx in (0, tw):
        t += pinnacle(tx + dx, base - th - 2, 8, 30)
    t += pinnacle(tx + tw / 2, base - th - 2, 6, 18)
    return t


def bridge(cx, base):
    """Разводной мост: две башни на быках, верхние переходы, цепи с подвесками и пролёты над водой."""
    half = 92; tw = 42; th = 132; deck = base - 30; reach = 300
    t = ''
    # цепи и подвески
    for sgn in (-1, 1):
        ax, ay = cx + sgn * (half + tw / 2 - 4), base - th + 26
        bx, by = cx + sgn * reach, deck - 20
        mx, my = (ax + bx) / 2 + sgn * 10, deck - 6
        for off, o in ((0, .8), (5, .4)):
            t += gl(f'M{f(ax)} {f(ay+off)}Q{f(mx)} {f(my+off)} {f(bx)} {f(by+off)}', o, 1.3 if off == 0 else .9)
        d = ''
        for i in range(1, 12):
            u = i / 12
            px = (1 - u) ** 2 * ax + 2 * u * (1 - u) * mx + u * u * bx
            py = (1 - u) ** 2 * ay + 2 * u * (1 - u) * my + u * u * by
            d += f'M{f(px)} {f(py)}V{f(deck)}'
        t += gl(d, .35, .8)
        # береговая башенка
        t += f'<rect x="{f(bx-9)}" y="{f(deck-34)}" width="18" height="{f(base-deck+34)}" fill="{BD}"/>'
        t += pinnacle(bx, deck - 34, 20, 18)
        t += win(bx, base - 6, 8, 12, False, False)
    # настил и разводной пролёт
    t += f'<rect x="{f(cx-reach-30)}" y="{f(deck)}" width="{f(2*reach+60)}" height="7" fill="#1C2A6E"/>'
    t += gl(f'M{f(cx-reach-30)} {f(deck)}H{f(cx+reach+30)}', .7, 1.1)
    t += f'<path d="M{f(cx-half+tw/2)} {f(deck+7)}Q{f(cx)} {f(deck+22)} {f(cx+half-tw/2)} {f(deck+7)}Z" fill="#1C2A6E"/>'
    d = ''
    for i in range(-14, 15):
        px = cx + i * 21
        if abs(abs(px - cx) - half) > tw / 2 + 2:
            d += f'M{f(px)} {f(deck-5)}V{f(deck)}'
    t += gl(d, .5, .8)
    # верхние переходы
    wy = base - th + 34
    t += f'<rect x="{f(cx-half)}" y="{f(wy)}" width="{f(2*half)}" height="11" fill="{BD}"/>'
    t += gl(f'M{f(cx-half)} {f(wy)}H{f(cx+half)}M{f(cx-half)} {f(wy+11)}H{f(cx+half)}', .7)
    d = ''
    x = cx - half + tw / 2 + 4
    while x < cx + half - tw / 2 - 6:
        d += f'M{f(x)} {f(wy+11)}L{f(x+6)} {f(wy)}L{f(x+12)} {f(wy+11)}'
        x += 12
    t += gl(d, .4, .7)
    # башни
    for sgn in (-1, 1):
        tx = cx + sgn * half
        t += f'<path d="M{f(tx-tw/2-7)} {f(base)}V{f(deck+9)}Q{f(tx-tw/2-7)} {f(deck+4)} {f(tx-tw/2)} {f(deck+4)}H{f(tx+tw/2)}Q{f(tx+tw/2+7)} {f(deck+4)} {f(tx+tw/2+7)} {f(deck+9)}V{f(base)}Z" fill="#141F5A"/>'
        t += f'<rect x="{f(tx-tw/2)}" y="{f(base-th)}" width="{tw}" height="{f(th-26)}" fill="{BD}"/>'
        t += f'<path d="M{f(tx-tw/2)} {f(base-th)}V{f(deck+4)}" stroke="{EDGE}" stroke-width="1.2" opacity=".8"/>'
        t += gl(f'M{f(tx-tw/2-2)} {f(base-th+34)}H{f(tx+tw/2+2)}M{f(tx-tw/2-2)} {f(base-th+70)}H{f(tx+tw/2+2)}', .35)
        # крыша-шатёр
        t += f'<path d="M{f(tx-tw/2+5)} {f(base-th)}L{f(tx-5)} {f(base-th-30)}H{f(tx+5)}L{f(tx+tw/2-5)} {f(base-th)}Z" fill="{BD}"/>'
        t += gl(f'M{f(tx-tw/2+5)} {f(base-th)}L{f(tx-5)} {f(base-th-30)}H{f(tx+5)}M{f(tx)} {f(base-th-30)}V{f(base-th-40)}', .75)
        t += f'<circle cx="{f(tx)}" cy="{f(base-th-41)}" r="1.6" fill="{GOLD}"/>'
        for dx in (-tw / 2 + 2, tw / 2 - 2):
            t += f'<rect x="{f(tx+dx-4.5)}" y="{f(base-th-8)}" width="9" height="{f(th-26)}" fill="{BD}"/>'
            t += f'<path d="M{f(tx+dx-4.5)} {f(base-th-8)}V{f(deck)}" stroke="{EDGE}" stroke-width="1" opacity=".7"/>'
            t += pinnacle(tx + dx, base - th - 8, 10, 24)
        for k, yy in enumerate((base - th + 28, base - th + 62)):
            for dx in (-7, 7):
                t += win(tx + dx, yy, 6.5, 11, True, False)
        # проезд
        t += win(tx, deck, 17, 15, False, False)
        t += f'<path d="M{f(tx-8.5)} {f(deck)}V{f(deck-15)}Q{f(tx-8.5)} {f(deck-27)} {f(tx)} {f(deck-32)}Q{f(tx+8.5)} {f(deck-27)} {f(tx+8.5)} {f(deck-15)}V{f(deck)}" fill="{LAMP}" opacity=".16"/>'
    return t


def dome(x, base, s=1.0, col='#1D2C74', o=.8):
    """Собор с куполом на дальнем берегу."""
    def p(dx, dy):
        return f'{f(x+dx*s)} {f(base+dy*s)}'
    d = (f'M{p(-74,0)}L{p(-74,-34)}L{p(-52,-34)}L{p(-64,-34)}L{p(-58,-58)}L{p(-52,-34)}L{p(-34,-34)}L{p(-52,-46)}L{p(-30,-46)}'
         f'L{p(-30,-66)}L{p(-27,-66)}C{p(-27,-92)} {p(-12,-104)} {p(0,-106)}C{p(12,-104)} {p(27,-92)} {p(27,-66)}L{p(30,-66)}L{p(30,-46)}'
         f'L{p(34,-46)}L{p(34,-34)}L{p(52,-34)}L{p(58,-58)}L{p(64,-34)}L{p(74,-34)}L{p(74,0)}Z')
    t = f'<path d="{d}" fill="{col}" opacity="{o}"/>'
    t += f'<path d="M{p(-5,-104)}L{p(-5,-116)}L{p(5,-116)}L{p(5,-104)}ZM{p(-2.5,-116)}L{p(0,-130)}L{p(2.5,-116)}Z" fill="{col}" opacity="{o}"/>'
    t += gl(f'M{p(-27,-66)}C{p(-27,-92)} {p(-12,-104)} {p(0,-106)}M{p(-30,-66)}L{p(30,-66)}M{p(-34,-46)}L{p(34,-46)}', .45, .9)
    dd = ''
    for i in range(-4, 5):
        dd += f'M{p(i*6.2,-50)}L{p(i*6.2,-62)}'
    t += f'<path d="{dd}" stroke="{LAMP}" stroke-width="{f(1.6*s)}" opacity=".45"/>'
    return t


def skyline(rng, y, x0=0, x1=1600, op=.5, skip=()):
    t = ''; d = ''; lights = ''
    x = x0
    while x < x1:
        w = rng.randint(16, 36); h = rng.randint(18, 56)
        kind = rng.choice(['flat', 'gable', 'spire', 'flat', 'chim'])
        if any(a <= x <= b2 for a, b2 in skip):
            h = rng.randint(10, 22); kind = 'flat'
        d += f'M{x} {y}V{y-h}H{x+w}V{y}Z'
        if kind == 'gable':
            d += f'M{x-2} {y-h}L{f(x+w/2)} {y-h-12}L{x+w+2} {y-h}Z'
        elif kind == 'spire':
            d += f'M{f(x+w/2-4)} {y-h}L{f(x+w/2)} {y-h-30}L{f(x+w/2+4)} {y-h}Z'
        elif kind == 'chim':
            d += f'M{x+3} {y-h}V{y-h-8}H{x+7}V{y-h}Z'
        for _ in range(rng.randint(0, 3)):
            wx = x + rng.randint(3, max(4, w - 6)); wy = y - rng.randint(6, max(7, h - 6))
            lights += f'M{wx} {wy}v3.2'
        x += w + rng.randint(0, 4)
    t += f'<path d="{d}" fill="{FAR}" opacity="{op}"/>'
    t += f'<path d="{lights}" stroke="{LAMP}" stroke-width="2.2" opacity=".5"/>'
    return t


def lamp(x, base, s=1.0):
    """Викторианский фонарь: столб на цоколе, перекладина, гранёный плафон и тёплое сияние."""
    def p(dx, dy):
        return f'{f(x+dx*s)} {f(base+dy*s)}'
    c = '#04071A'
    t = f'<circle cx="{f(x)}" cy="{f(base-160*s)}" r="{f(74*s)}" fill="url(#lg)"/>'
    t += f'<path d="M{p(-9,0)}L{p(9,0)}L{p(6,-8)}L{p(4,-8)}L{p(3,-30)}L{p(-3,-30)}L{p(-4,-8)}L{p(-6,-8)}Z" fill="{c}"/>'
    t += f'<path d="M{p(0,-28)}L{p(0,-146)}" stroke="{c}" stroke-width="{f(3.6*s)}"/>'
    t += f'<path d="M{p(-5,-34)}L{p(5,-34)}M{p(-4,-96)}L{p(4,-96)}M{p(-12,-134)}L{p(12,-134)}M{p(-5,-141)}L{p(5,-141)}" stroke="{c}" stroke-width="{f(2.6*s)}" stroke-linecap="round"/>'
    t += f'<path d="M{p(-6,-146)}L{p(-10.5,-170)}L{p(10.5,-170)}L{p(6,-146)}Z" fill="#FFE9B4"/>'
    t += f'<path d="M{p(-6,-146)}L{p(-10.5,-170)}L{p(10.5,-170)}L{p(6,-146)}ZM{p(0,-146)}L{p(0,-170)}" fill="none" stroke="{c}" stroke-width="{f(1.5*s)}" stroke-linejoin="round"/>'
    t += f'<path d="M{p(-13,-170)}L{p(13,-170)}L{p(5,-180)}L{p(-5,-180)}ZM{p(-2.5,-180)}L{p(2.5,-180)}L{p(0,-190)}Z" fill="{c}"/>'
    t += f'<path d="M{p(-8,-145)}L{p(8,-145)}" stroke="{c}" stroke-width="{f(3*s)}" stroke-linecap="round"/>'
    t += gl(f'M{p(-13,-170)}L{p(-5,-180)}L{p(5,-180)}', .7, .9)
    return t


def oak(x, base, s=1.0):
    c = '#050920'
    t = f'<path d="M{f(x-9*s)} {f(base)}Q{f(x-5*s)} {f(base-34*s)} {f(x-12*s)} {f(base-70*s)}L{f(x+12*s)} {f(base-70*s)}Q{f(x+5*s)} {f(base-34*s)} {f(x+10*s)} {f(base)}Z" fill="{c}"/>'
    t += f'<path d="M{f(x)} {f(base-60*s)}L{f(x-40*s)} {f(base-104*s)}M{f(x)} {f(base-60*s)}L{f(x+42*s)} {f(base-100*s)}" stroke="{c}" stroke-width="{f(7*s)}" stroke-linecap="round"/>'
    blobs = [(0, -150, 46), (-44, -128, 40), (46, -126, 40), (-76, -100, 32), (78, -98, 32), (-24, -104, 40), (26, -102, 40), (0, -182, 30), (-40, -164, 28), (40, -162, 28)]
    for dx, dy, r in blobs:
        t += f'<circle cx="{f(x+dx*s)}" cy="{f(base+dy*s)}" r="{f(r*s)}" fill="{c}"/>'
    for dx, dy, r in [(0, -182, 30), (-40, -164, 28), (40, -162, 28), (-76, -100, 32), (78, -98, 32), (-10, -140, 30), (30, -118, 26)]:
        t += f'<path d="M{f(x+dx*s-r*s*.8)} {f(base+dy*s-r*s*.6)}A{f(r*s)} {f(r*s)} 0 0 1 {f(x+dx*s+r*s*.8)} {f(base+dy*s-r*s*.6)}" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".38"/>'
    return t


def leaf(x, y, a, L, col='#1C4A3B', vein='#3F7C63'):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({f(a)})"><path d="M0 0C{f(L*.3)} {f(-L*.34)} {f(L*.75)} {f(-L*.3)} {f(L)} 0C{f(L*.75)} {f(L*.3)} {f(L*.3)} {f(L*.34)} 0 0Z" fill="{col}"/>'
            f'<path d="M0 0H{f(L*.9)}" stroke="{vein}" stroke-width=".8" fill="none"/></g>')


def rose(x, y, r, red=True, rot=0):
    """Роза: листья, пять внешних лепестков, три внутренних и завиток сердцевины."""
    dk, md, hi, ln = ('#6E1B30', '#A32F49', '#CF5F74', '#F0A0AC') if red else ('#9C8660', '#D8C6A0', '#F1E6CC', '#8A7450')
    t = ''
    for a in (rot + 200, rot + 335, rot + 80):
        t += leaf(x, y, a, r * 1.75)
    t += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r*.8)}" fill="{dk}"/>'
    for i in range(5):
        a = math.radians(rot + i * 72)
        t += f'<circle cx="{f(x+r*.52*math.cos(a))}" cy="{f(y+r*.52*math.sin(a))}" r="{f(r*.52)}" fill="{md}" stroke="{dk}" stroke-width="{f(max(.7, r*.06))}"/>'
    for i in range(3):
        a = math.radians(rot + 40 + i * 120)
        t += f'<circle cx="{f(x+r*.24*math.cos(a))}" cy="{f(y+r*.24*math.sin(a))}" r="{f(r*.36)}" fill="{hi}" stroke="{dk if red else ln}" stroke-width="{f(max(.6, r*.05))}"/>'
    t += (f'<path d="M{f(x-r*.2)} {f(y+r*.05)}A{f(r*.2)} {f(r*.2)} 0 1 1 {f(x+r*.12)} {f(y+r*.17)}A{f(r*.11)} {f(r*.11)} 0 1 1 {f(x)} {f(y-r*.03)}" '
          f'fill="none" stroke="{dk if red else ln}" stroke-width="{f(max(.8, r*.08))}" stroke-linecap="round"/>')
    return t


def scene_en():
    W, H = 1600, 300
    rng = random.Random(11)
    base = 250
    defs = (f'<radialGradient id="lg"><stop offset="0" stop-color="#FFE9B4" stop-opacity=".85"/><stop offset=".14" stop-color="{LAMP}" stop-opacity=".42"/>'
            f'<stop offset=".45" stop-color="{LAMP}" stop-opacity=".12"/><stop offset="1" stop-color="{LAMP}" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="bd" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="{base}"><stop offset="0" stop-color="#2E3D8C"/><stop offset=".55" stop-color="#18246A"/><stop offset="1" stop-color="#0B123A"/></linearGradient>'
            f'<linearGradient id="wn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7AE"/><stop offset="1" stop-color="#E2A955"/></linearGradient>'
            f'<linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16226A"/><stop offset="1" stop-color="{NEAR}"/></linearGradient>'
            f'<linearGradient id="rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{NEAR}" stop-opacity=".25"/><stop offset="1" stop-color="{NEAR}" stop-opacity="1"/></linearGradient>'
            f'<linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{LAMP}" stop-opacity=".5"/><stop offset="1" stop-color="{LAMP}" stop-opacity="0"/></linearGradient>')
    b = ''
    # дальний берег
    b += skyline(rng, base, 0, 1600, .55, skip=((1000, 1150),))
    b += dome(1085, base, .92)
    b += oak(96, base + 4, .78) + oak(1540, base + 4, .9)
    # здания у воды
    bld = parliament(346, 560, base) + clock_tower(318, base) + bridge(800, base) + chapel(1196, base)
    b += bld
    # река: отражения зданий, огни и рябь
    b += f'<rect x="0" y="{base}" width="{W}" height="{H-base}" fill="url(#rv)"/>'
    b += f'<g transform="translate(0 {2*base}) scale(1 -1)" opacity=".5">{bld}</g>'
    b += f'<rect x="0" y="{base}" width="{W}" height="{H-base}" fill="url(#rf)"/>'
    b += gl(f'M0 {base}H{W}', .45)
    for lx, lw in ((300, 36), (690, 36), (892, 36), (1085, 50)) + tuple((1212 + 34 * (i + .5) - 7, 14) for i in range(7)) + ((440, 90),):
        b += f'<rect x="{f(lx)}" y="{base+1}" width="{lw}" height="34" fill="url(#st)" opacity=".5"/>'
    d = ''
    for i in range(34):
        y = base + 5 + (i % 6) * 5.5; x = rng.randint(0, 1560); w = rng.randint(24, 110)
        d += f'M{x} {f(y)}h{w}'
    b += gl(d, .22, .8)
    # набережная на переднем плане
    quay = f'M0 {H}V284Q200 278 420 283T800 289Q1000 292 1180 284T1600 282V{H}Z'
    b += f'<path d="{quay}" fill="{NEAR}"/>'
    b += gl('M0 284Q200 278 420 283T800 289Q1000 292 1180 284T1600 282', .4)
    b += lamp(214, 285, 1.0) + lamp(1452, 285, .93)
    # розы у краёв
    for x, y, r, red, rot in [(150, 286, 13, False, 20), (176, 290, 17, True, 0), (258, 289, 15, True, 50), (284, 292, 10, False, 10),
                              (1374, 291, 11, True, 30), (1400, 288, 16, False, 0), (1496, 288, 17, True, 15), (1524, 292, 11, False, 60)]:
        b += rose(x, y, r, red, rot)
    d2, g = fade(W, H, b, .07)
    return svg(W, H, f'<defs>{defs}{d2}</defs>{g}', 'preserveAspectRatio="xMidYMax slice"')


# ============================== ЛЕНТЫ ==============================

def band_ko():
    """«Нвемун»: меандр из квадратных завитков между двумя тонкими линиями."""
    u = 32
    d = f'M0 15H{u}M0 1H{u}'
    k = 'M4 13V4H24V10H12V7H18'
    return svg(u, 16, f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width=".8" opacity=".5"/><path d="{k}" fill="none" stroke="{GOLD}" stroke-width="1.2" stroke-linejoin="miter" opacity=".85"/>')


def band_en():
    """Лоза: волнистая нить с завитками на изгибах и листьями."""
    u = 64
    vine = f'M0 8C10 0 22 0 32 8S54 16 {u} 8'
    curls = 'M16 3.2C13 .5 18 -1.6 19.5 1.6C20.5 3.8 17 5.2 16 3.2M48 12.8C51 15.5 46 17.6 44.5 14.4C43.5 12.2 47 10.8 48 12.8'
    leaves = f'M24 6.5C26 3 30 3 31 5.5C29 8 26 8 24 6.5ZM40 9.5C38 13 34 13 33 10.5C35 8 38 8 40 9.5Z'
    return svg(u, 16, f'<path d="{vine}" fill="none" stroke="{GOLD}" stroke-width="1.1" opacity=".85" stroke-linecap="round"/>'
               f'<path d="{curls}" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".8" stroke-linecap="round"/>'
               f'<path d="{leaves}" fill="{GOLD}" opacity=".6"/><circle cx="32" cy="8" r="1.6" fill="{GOLD}"/><circle cx="0" cy="8" r="1.3" fill="{GOLD}"/><circle cx="{u}" cy="8" r="1.3" fill="{GOLD}"/>')


# ============================== ЭМБЛЕМЫ ==============================

def emblem_ko():
    """Лотос-розетка из росписи «танчхон» в двойном кольце."""
    b = f'<circle cx="32" cy="32" r="30" fill="none" stroke="{GOLD}" stroke-width="1.3"/><circle cx="32" cy="32" r="26.5" fill="none" stroke="{GOLD}" stroke-width=".7" opacity=".6"/>'
    for i in range(16):
        a = math.radians(i * 22.5)
        b += f'<circle cx="{f(32+28.2*math.cos(a))}" cy="{f(32+28.2*math.sin(a))}" r=".9" fill="{GOLD}" opacity=".7"/>'
    for i in range(8):
        b += f'<path transform="rotate({i*45} 32 32)" d="M32 32C38.5 25 38.5 14 32 8.5C25.5 14 25.5 25 32 32Z" fill="none" stroke="{GOLD}" stroke-width="1.3" stroke-linejoin="round"/>'
        b += f'<path transform="rotate({i*45} 32 32)" d="M32 28C35 24 35 18 32 14.5C29 18 29 24 32 28Z" fill="none" stroke="{GOLD}" stroke-width=".8" opacity=".6"/>'
    for i in range(8):
        b += f'<path transform="rotate({i*45+22.5} 32 32)" d="M32 20.5C34.4 17.6 34.4 14.6 32 12C29.6 14.6 29.6 17.6 32 20.5Z" fill="{GOLD}" opacity=".6"/>'
    b += f'<circle cx="32" cy="32" r="4.2" fill="{GOLD}"/><circle cx="32" cy="32" r="1.6" fill="{NEAR}"/>'
    return svg(64, 64, b)


def emblem_en():
    """Герб: щит с розой Тюдоров и корона над ним, всё в кольце. Линии толстые, чтобы читался и в шапке."""
    b = f'<circle cx="32" cy="32" r="30" fill="none" stroke="{GOLD}" stroke-width="1.4"/>'
    b += f'<path d="M19 21H45V35C45 43.5 38.5 48.5 32 51.5C25.5 48.5 19 43.5 19 35Z" fill="none" stroke="{GOLD}" stroke-width="2.1" stroke-linejoin="round"/>'
    for i in range(5):
        a = math.radians(i * 72 - 90)
        b += f'<circle cx="{f(32+5.7*math.cos(a))}" cy="{f(34.5+5.7*math.sin(a))}" r="3.7" fill="{GOLD}"/>'
    b += f'<circle cx="32" cy="34.5" r="2.3" fill="{NEAR}"/>'
    b += f'<path d="M23 17.5L24.2 9.5L28.2 13.6L32 8L35.8 13.6L39.8 9.5L41 17.5Z" fill="{GOLD}"/>'
    return svg(64, 64, b)


# ============================== УГЛОВЫЕ ОРНАМЕНТЫ ==============================
# Угол рамки 56×56: левый верхний; в стилях поворачивается и отражается.

def corner_ko():
    """Угол с «облаком сун» и дугами."""
    b = f'<path d="M2 54V16Q2 2 16 2H54" fill="none" stroke="{GOLD}" stroke-width="1.2" stroke-linecap="round"/>'
    b += f'<path d="M8 54V20Q8 8 20 8H54" fill="none" stroke="{GOLD}" stroke-width=".7" opacity=".5"/>'
    b += (f'<path d="M12 12C9 18 15 23 20 20C25 17 22 11 17 12C14 12.5 13 15 15 16.5" fill="none" stroke="{GOLD}" stroke-width="1" stroke-linecap="round"/>'
          f'<path d="M20 20C27 24 32 20 36 22" fill="none" stroke="{GOLD}" stroke-width="1" stroke-linecap="round" opacity=".8"/>')
    b += f'<circle cx="6" cy="6" r="1.8" fill="{GOLD}"/>'
    return svg(56, 56, b)


def corner_en():
    """Угол с завитком лозы и листом."""
    b = f'<path d="M2 54V18Q2 2 18 2H54" fill="none" stroke="{GOLD}" stroke-width="1.2" stroke-linecap="round"/>'
    b += (f'<path d="M10 10C20 10 28 14 30 24C31.5 31 26 36 21 33C17 31 18 25 22 25" fill="none" stroke="{GOLD}" stroke-width="1" stroke-linecap="round"/>'
          f'<path d="M10 10C10 20 14 28 24 30" fill="none" stroke="{GOLD}" stroke-width="1" stroke-linecap="round" opacity=".7"/>'
          f'<path d="M30 24C36 22 42 24 46 20C42 16 36 17 30 24Z" fill="{GOLD}" opacity=".55"/>'
          f'<path d="M24 30C22 36 24 42 20 46C16 42 17 36 24 30Z" fill="{GOLD}" opacity=".55"/>')
    b += f'<circle cx="6" cy="6" r="1.8" fill="{GOLD}"/>'
    return svg(56, 56, b)


# ============================== РАМКИ ДЛЯ КАРТОЧЕК ==============================
# Рамка 168×168 из четырёх углов; в стилях режется на девять частей (border-image, срез 56),
# поэтому углы не растягиваются, а прямые стороны тянутся под размер карточки.

def _frame(corner_svg, edges):
    inner = corner_svg[corner_svg.index('>') + 1:corner_svg.rindex('</svg>')]
    b = ''
    for tr in ('', 'translate(168 0) scale(-1 1)', 'translate(0 168) scale(1 -1)', 'translate(168 168) scale(-1 -1)'):
        b += f'<g transform="{tr}">{inner}</g>' if tr else f'<g>{inner}</g>'
    return svg(168, 168, b + edges, 'width="168" height="168"')   # размер нужен, чтобы border-image резал рамку в пикселях


def frame_ko():
    e = (f'<path d="M54 2H114M54 166H114M2 54V114M166 54V114" fill="none" stroke="{GOLD}" stroke-width="1.2"/>'
         f'<path d="M54 8H114M54 160H114M8 54V114M160 54V114" fill="none" stroke="{GOLD}" stroke-width=".7" opacity=".5"/>')
    return _frame(corner_ko(), e)


def frame_en():
    e = f'<path d="M54 2H114M54 166H114M2 54V114M166 54V114" fill="none" stroke="{GOLD}" stroke-width="1.2"/>'
    return _frame(corner_en(), e)


# ============================== ВОЛНЫ-УЗОР ДЛЯ ЗАЛИВКИ БУКВ ==============================

def seigaiha():
    """Плитка узора «чхонхэ» 40×20 для заливки заголовка (используется в CSS)."""
    R = 10; t = ''
    for row, (y, off) in enumerate([(10, 0), (20, 10)]):
        for x in (off, off + 20, off + 40):
            t += f'<path d="M{x-R} {y}A{R} {R} 0 0 1 {x+R} {y}" fill="none" stroke="{GOLD}" stroke-width=".8" opacity=".55"/>'
            t += f'<path d="M{x-R*.66} {y}A{R*.66} {R*.66} 0 0 1 {x+R*.66} {y}" fill="none" stroke="{GOLD}" stroke-width=".8" opacity=".4"/>'
            t += f'<path d="M{x-R*.33} {y}A{R*.33} {R*.33} 0 0 1 {x+R*.33} {y}" fill="none" stroke="{GOLD}" stroke-width=".8" opacity=".3"/>'
    return svg(40, 20, t)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('scene-ko', scene_ko), ('scene-en', scene_en), ('band-ko', band_ko), ('band-en', band_en),
                     ('emblem-ko', emblem_ko), ('emblem-en', emblem_en), ('corner-ko', corner_ko), ('corner-en', corner_en),
                     ('frame-ko', frame_ko), ('frame-en', frame_en),
                     ('seigaiha', seigaiha)]:
        s = fn()
        open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf8').write(s)
        print(name, len(s))
