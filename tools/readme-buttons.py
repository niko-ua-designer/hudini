#!/usr/bin/env python3
"""Generates the gradient link buttons of the READMEs: docs/buttons/<lang>/<name>.svg (en, ru, uk, de)."""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ICON = {
 'dl': '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
 'web': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
 'help': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
 'tg': '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
 'idea': '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'}
PRIM = '<stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff5c9a"/>'
DARK = '<stop offset="0" stop-color="#241f4a"/><stop offset="1" stop-color="#171a2b"/>'
TG = '<stop offset="0" stop-color="#2aa5e0"/><stop offset="1" stop-color="#1f7ccc"/>'
LABELS = {
 'en': dict(download='Download Hudini', website='Website', help='Help', telegram='Telegram', idea='Idea or problem'),
 'ru': dict(download='Скачать Hudini', website='Сайт', help='Справка', telegram='Telegram', idea='Идея или проблема'),
 'uk': dict(download='Завантажити Hudini', website='Сайт', help='Довідка', telegram='Telegram', idea='Ідея або проблема'),
 'de': dict(download='Hudini herunterladen', website='Website', help='Hilfe', telegram='Telegram', idea='Idee oder Problem')}
SPEC = {  # name: (icon, width, height, fill, stroke, font size, icon size); the four small buttons share one size so the 2x2 grid lines up
 'download': ('dl', 340, 76, PRIM, '#ffffff55', 24, 28),
 'website': ('web', 250, 60, DARK, '#9b7dff99', 19, 22),
 'help': ('help', 250, 60, DARK, '#9b7dff99', 19, 22),
 'telegram': ('tg', 250, 60, TG, '#ffffff55', 19, 22),
 'idea': ('idea', 250, 60, DARK, '#ff5c9a99', 19, 22)}
def btn(lang, name):
    icon, w, h, fill, stroke, fs, ic = SPEC[name]; label = LABELS[lang][name]
    top = (h - 10 - ic) / 2 + 3; ty = (h - 10) / 2 + 3 + fs * 0.35
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">{fill}</linearGradient>
<filter id="s" x="-20%" y="-40%" width="140%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#7c5cff" flood-opacity=".45"/></filter></defs>
<rect x="3" y="3" width="{w-6}" height="{h-10}" rx="{(h-10)/2}" fill="url(#g)" stroke="{stroke}" stroke-width="1.5" filter="url(#s)"/>
<g transform="translate(22,{top}) scale({ic/24})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{ICON[icon]}</g>
<text x="{22+ic+12}" y="{ty}" fill="#fff" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" font-weight="700" font-size="{fs}">{label}</text>
</svg>'''
    d = os.path.join(ROOT, 'docs', 'buttons', lang); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, name + '.svg'), 'w', encoding='utf-8').write(svg)
for lang in LABELS:
    for name in SPEC: btn(lang, name)
print('ok')
