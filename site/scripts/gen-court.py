#!/usr/bin/env python3
"""
Generuje boisko 3x3 z hero strony głównej:

  src/components/HeroCourt.astro   dwa warianty SVG (desktop / telefon) + warstwa błysku
  src/data/court.json              proporcje sceny i pozycje kart w % (ta sama projekcja)

Boisko: połowa FIBA 15 x 11 m z liniami zgodnymi z przepisami (trumna 4,9 x 5,8 m, linia
rzutów wolnych, łuk za 3 pkt R = 6,75 m, półkole bez szarży R = 1,25 m, obręcz 1,575 m od
linii końcowej, znaczniki zbiórek).

Kamera stoi za linią końcową na osi boiska: d metrów za linią, h metrów nad parkietem.
Punkt parkietu (x, y) [m; x od osi, y od linii końcowej] trafia na ekran w (x/(y+d), h/(y+d)).
Okrąg na parkiecie ze środkiem na osi jest na ekranie elipsą osiową, więc łuki rysujemy
dokładnie (komenda A), bez łamanych.

Strojenie: zmień VARIANTS (kamera, kadr, pozycje kart w metrach) i uruchom
    python3 scripts/gen-court.py
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = 1000.0     # skala jednostek viewBox (unikamy ułamków rzędu 0,001)
L = 11.0       # długość boiska 3x3 od linii końcowej
HOOP = 1.575   # środek obręczy od linii końcowej

VARIANTS = {
    # d, h: kamera [m]; half: połowa szerokości kadru; top: górna krawędź kadru (jedn. projekcji);
    # ref: szerokość sceny [px], dla której dobrane są skale kart w index.astro.
    'desk': {
        'd': 10.0, 'h': 15.0, 'half': 0.95, 'top': 0.66, 'ref': 1280,
        'spots': {'pg': (-2.4, 7.95), 'sg': (2.4, 7.95), 'sf': (-5.4, 3.2), 'pf': (5.4, 3.2), 'c': (0.0, 0.9)},
    },
    # Telefon: kamera wyżej (boisko wyższe na ekranie), kadr ciaśniej na liniach bocznych.
    'mob': {
        'd': 10.0, 'h': 24.0, 'half': 0.78, 'top': 1.06, 'ref': 390,
        'spots': {'pg': (-2.8, 7.95), 'sg': (2.8, 7.95), 'sf': (-5.9, 3.2), 'pf': (5.9, 3.2), 'c': (0.0, 0.9)},
    },
}


def build(key, v):
    d, h = v['d'], v['h']

    def P(x, y):
        return (S * x / (y + d), S * h / (y + d))

    def pt(x, y):
        X, Y = P(x, y)
        return f'{X:.1f} {Y:.1f}'

    def ell(c, r):
        """Obraz okręgu (środek (0, c), promień r): (cy, rx, ry) elipsy osiowej."""
        D = c + d
        y1, y2 = S * h / (D + r), S * h / (D - r)
        return (y1 + y2) / 2, S * r / math.sqrt(D * D - r * r), (y2 - y1) / 2

    def arc(c, r, x, y, large, sweep):
        _, rx, ry = ell(c, r)
        return f'A{rx:.1f} {ry:.1f} 0 {large} {sweep} {pt(x, y)}'

    def ellipse(c, r, extra=''):
        cy, rx, ry = ell(c, r)
        return f'<ellipse cx="0" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"{extra} />'

    x0, w = -v['half'] * S, 2 * v['half'] * S
    y0 = v['top'] * S
    hgt = S * h / d + 4.0 - y0            # +4: zapas na grubość linii końcowej
    vb = f'{x0:.0f} {y0:.0f} {w:.0f} {hgt:.1f}'

    court = f'M{pt(-7.5, 0)} L{pt(7.5, 0)} L{pt(7.5, L)} L{pt(-7.5, L)} Z'
    key_fill = f'M{pt(-2.45, 0)} L{pt(2.45, 0)} L{pt(2.45, 5.8)} L{pt(-2.45, 5.8)} Z'
    lane = f'M{pt(-2.45, 0)} L{pt(-2.45, 5.8)} L{pt(2.45, 5.8)} L{pt(2.45, 0)}'
    # Koło rzutów wolnych: dalsza połowa ciągła, bliższa (w trumnie) przerywana.
    ft_far = f'M{pt(-1.8, 5.8)} {arc(5.8, 1.8, 1.8, 5.8, 0, 1)}'
    ft_near = f'M{pt(-1.8, 5.8)} {arc(5.8, 1.8, 1.8, 5.8, 1, 0)}'
    three = f'M{pt(-6.6, 0)} L{pt(-6.6, 2.99)} {arc(HOOP, 6.75, 6.6, 2.99, 0, 1)} L{pt(6.6, 0)}'
    nocharge = f'M{pt(-1.25, 1.2)} L{pt(-1.25, HOOP)} {arc(HOOP, 1.25, 1.25, HOOP, 0, 1)} L{pt(1.25, 1.2)}'
    board = f'M{pt(-0.9, 1.2)} L{pt(0.9, 1.2)}'
    ticks = [f'M{pt(sx * 2.45, y)} L{pt(sx * 2.68, y)}' for sx in (-1, 1) for y in (3.05, 3.95, 4.85)]
    blocks = [f'M{pt(sx * 2.45, 1.75)} L{pt(sx * 2.66, 1.75)} L{pt(sx * 2.66, 2.15)} L{pt(sx * 2.45, 2.15)} Z'
              for sx in (-1, 1)]

    line_paths = [court, lane, ft_far, three, nocharge, board] + ticks
    lines = ''.join(f'<path d="{p}" />' for p in line_paths) + ellipse(HOOP, 0.225)

    y_far, y_near = P(0, L)[1], P(0, 0)[1]
    static = f'''<svg class="court-bg v-{key}" viewBox="{vb}" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="cf-{key}" gradientUnits="userSpaceOnUse" x1="0" y1="{y_far:.1f}" x2="0" y2="{y_near:.1f}">
      <stop offset="0" stop-color="#2F91D6" stop-opacity="0.03" />
      <stop offset="1" stop-color="#2F91D6" stop-opacity="0.17" />
    </linearGradient>
    <radialGradient id="cs-{key}">
      <stop offset="0" stop-color="#6FC3FF" stop-opacity="0.24" />
      <stop offset="0.55" stop-color="#2F91D6" stop-opacity="0.07" />
      <stop offset="1" stop-color="#2F91D6" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="ch-{key}">
      <stop offset="0" stop-color="#BFE3FF" stop-opacity="0.5" />
      <stop offset="1" stop-color="#6FC3FF" stop-opacity="0" />
    </radialGradient>
  </defs>
  <path d="{court}" fill="url(#cf-{key})" />
  <path class="cf-zone" d="{three} Z" />
  <path class="cf-key" d="{key_fill}" />
  {ellipse(3.4, 4.8, f' fill="url(#cs-{key})"')}
  {ellipse(HOOP, 1.6, f' fill="url(#ch-{key})"')}
  {''.join(f'<path class="cf-block" d="{b}" />' for b in blocks)}
  <g class="cl cl-g2">{lines}</g>
  <g class="cl cl-g1">{lines}</g>
  <g class="cl cl-main">{lines}</g>
  <path class="cl-dash" d="{ft_near}" />
</svg>'''

    glint = f'''<svg class="glint-lines v-{key}" viewBox="{vb}" preserveAspectRatio="none">
      <g class="gl gl-soft">{lines}</g>
      <g class="gl gl-main">{lines}</g>
    </svg>'''

    spots = {}
    for name, (x, y) in v['spots'].items():
        X, Y = P(x, y)
        spots[name] = [round((X - x0) / w * 100, 2), round((Y - y0) / hgt * 100, 2)]

    # Narożniki boiska w % sceny (lewy/prawy przy linii końcowej): do szerokości paska pod boiskiem.
    near_l = (P(-7.5, 0)[0] - x0) / w * 100
    data = {'ar': f'{w:.0f} / {hgt:.1f}', 'ratio': round(w / hgt, 4), 'ref': v['ref'], 'spots': spots,
            'courtWidth': round(100 - 2 * near_l, 2)}
    return static, glint, data


def main():
    out = {k: build(k, v) for k, v in VARIANTS.items()}
    data = {k: o[2] for k, o in out.items()}

    component = f'''---
// WYGENEROWANE przez scripts/gen-court.py (kamera, linie FIBA, warianty desktop i telefon).
// Nie edytuj ręcznie: zmień parametry w skrypcie i uruchom `python3 scripts/gen-court.py`.
// Rodzic (.court-stage) musi mieć container-type: inline-size, bo błysk liczy się w cqw.
---
{out['desk'][0]}
{out['mob'][0]}
<!-- Błysk po liniach: jasna kopia linii stoi w miejscu, a po scenie przesuwa się ukośne „okno" z miękką maską.
     Okno i kopia animują wyłącznie transform (w przeciwne strony), więc całość liczy GPU, bez malowania klatek. -->
<div class="court-glint" aria-hidden="true">
  <div class="glint-win">
    {out['desk'][1]}
    {out['mob'][1]}
  </div>
</div>

<style>
  .court-bg, .court-glint {{ position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 24%); mask-image: linear-gradient(180deg, transparent 0%, #000 24%); }}
  .v-mob {{ display: none; }}
  @media (max-width: 640px) {{
    .v-desk {{ display: none; }} .v-mob {{ display: block; }}
    /* mniejsze boisko: cieńsze linie i ciaśniejsza poświata, żeby nie wyglądały na rozmyte */
    .cl-main {{ stroke-width: 1.25px; }} .cl-g1 {{ stroke-width: 3.2px; }} .cl-g2 {{ stroke-width: 7px; }}
    .gl-main {{ stroke-width: 1.6px; }} .gl-soft {{ stroke-width: 5px; }}
  }}

  /* Grubości linii w px ekranu (non-scaling-stroke), więc boisko wygląda tak samo ostro na telefonie i na monitorze */
  .court-bg :is(path, ellipse), .glint-lines :is(path, ellipse) {{ vector-effect: non-scaling-stroke; }}
  .cf-zone {{ fill: rgba(47,145,214,0.05); }}
  .cf-key {{ fill: rgba(47,145,214,0.16); }}
  .cf-block {{ fill: rgba(217,238,255,0.85); }}
  .cl {{ fill: none; stroke: #D9EEFF; stroke-linejoin: round; stroke-linecap: round; }}
  .cl-main {{ stroke-width: 1.6px; stroke-opacity: 0.9; }}
  .cl-g1 {{ stroke-width: 4.5px; stroke-opacity: 0.14; }}      /* poświata linii bez filtrów: dwa szersze, słabe obrysy */
  .cl-g2 {{ stroke-width: 10px; stroke-opacity: 0.06; }}
  .cl-dash {{ fill: none; stroke: #D9EEFF; stroke-opacity: 0.5; stroke-width: 1.4px; stroke-dasharray: 7 6; }}

  .court-glint {{ overflow: hidden; }}
  .glint-win {{ position: absolute; top: 0; bottom: 0; left: 0; width: 22cqw; overflow: hidden; transform-origin: 0 0;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 50%, transparent); mask-image: linear-gradient(90deg, transparent, #000 50%, transparent);
    transform: translateX(-36cqw) skewX(-16deg); will-change: transform;
    animation: hc-glint-win 9s cubic-bezier(.45,0,.25,1) 2.6s infinite; }}
  .glint-lines {{ position: absolute; top: 0; left: 0; width: 100cqw; height: auto; max-width: none; transform-origin: 0 0;
    transform: skewX(16deg) translateX(36cqw); will-change: transform;
    animation: hc-glint-lines 9s cubic-bezier(.45,0,.25,1) 2.6s infinite; }}
  .glint-lines.v-desk {{ aspect-ratio: {data['desk']['ar']}; }}
  .glint-lines.v-mob {{ aspect-ratio: {data['mob']['ar']}; }}
  .gl {{ fill: none; stroke: #FFFFFF; stroke-linejoin: round; stroke-linecap: round; }}
  .gl-main {{ stroke-width: 2px; }}
  .gl-soft {{ stroke-width: 7px; stroke-opacity: 0.3; }}
  @keyframes hc-glint-win {{
    0% {{ transform: translateX(-36cqw) skewX(-16deg); }}
    30%, 100% {{ transform: translateX(118cqw) skewX(-16deg); }}
  }}
  @keyframes hc-glint-lines {{
    0% {{ transform: skewX(16deg) translateX(36cqw); }}
    30%, 100% {{ transform: skewX(16deg) translateX(-118cqw); }}
  }}
  :global(.court-stage.paused) :is(.glint-win, .glint-lines) {{ animation-play-state: paused; }}
  @media (prefers-reduced-motion: reduce) {{ .court-glint {{ display: none; }} }}
</style>
'''
    (ROOT / 'src/components/HeroCourt.astro').write_text(component, encoding='utf-8')
    (ROOT / 'src/data').mkdir(parents=True, exist_ok=True)
    (ROOT / 'src/data/court.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

    for k, dct in data.items():
        print(f"{k}: proporcje {dct['ar']} ({dct['ratio']}), boisko {dct['courtWidth']}% sceny")
        for name, (x, y) in dct['spots'].items():
            print(f'   {name:3s} {x:6.2f}% {y:6.2f}%')


if __name__ == '__main__':
    main()
