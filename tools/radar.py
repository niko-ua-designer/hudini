#!/usr/bin/env python3
"""Hudini radar backgrounds for CS2: a top-down map picture -> web/shared/radar/<map>-<theme>.webp, one per HUD theme.

Only the shape of the walkable area is taken from the source (a mask and its outline) and the rough height tiers
(lighter = higher in the overview pictures, blurred and cut to a few steps). Colours, textures, icons, zone marks,
labels and the edge grid of the source are dropped; the area is redrawn in the look of each CS2 HUD theme of core.css:
classic (dense dark floor, bright outline), glass (see-through floor, light outline and glow), ko (blue-violet gradient,
topo lines, violet glow). Same geometry, three colourings, the same on every map.

Usage:
  python3 tools/radar.py                        # every known map from cs2maps/ (or radar-src/) into web/shared/radar/
  python3 tools/radar.py de_mirage de_dust2     # only these maps
  python3 tools/radar.py --src DIR --out DIR    # other folders (e.g. --out server/data/radar for a local override)
  python3 tools/radar.py --calib de_x "x1,y1=px1,py1;x2,y2=px2,py2"
        # two world points and where they are on a 1024 x 1024 source: prints pos_x, pos_y, scale for web/shared/cs2-maps.js

Source names: <map>_radar_psd.png, <map>_radar.png, <map>.png (1024 x 1024 or 2048 x 2048, any background).
The Host serves data/radar/<map>-<theme>.webp first, so a streamer can drop in an own background without a new build.
Needs Pillow and numpy (pip install pillow numpy).
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# map -> source picture (the first one found). ancient: the day version; cache and cobblestone: the 1024 psd export
MAPS = {
    'de_dust2': ['de_dust2'], 'de_mirage': ['de_mirage'], 'de_inferno': ['de_inferno'], 'de_overpass': ['de_overpass'],
    'de_nuke': ['de_nuke'], 'de_nuke_lower': ['de_nuke_lower'], 'de_vertigo': ['de_vertigo'], 'de_vertigo_lower': ['de_vertigo_lower'], 'de_train_lower': ['de_train_lower'],
    'de_ancient': ['de_ancient_v1', 'de_ancient'], 'de_anubis': ['de_anubis'], 'de_cache': ['de_cache'], 'de_cbble': ['de_cbble'],
    'cs_office': ['cs_office'], 'cs_italy': ['cs_italy'], 'de_train': ['de_train'],
}
SIZE = 1024
GRID = 64
# Three looks, one per CS2 HUD theme in core.css (classic / glass / ko): floor colours, outline, glow, grid or topo lines.
# fill: top and bottom colour of the floor gradient (RGBA), tier: brightness step between height tiers,
# line: outline colour, glow: colour and strength of the soft light around the area, grid: 'grid' or 'topo' and its alpha.
THEMES = {
    'classic': dict(fill=((40, 42, 50, 250), (22, 23, 29, 250)), tier=16, line=(236, 238, 245, 235), steps=(255, 255, 255, 70),
                    glow=((0, 0, 0), 0.55), grid=('grid', 20)),
    'glass':   dict(fill=((70, 80, 112, 150), (28, 32, 48, 130)), tier=22, line=(255, 255, 255, 200), steps=(255, 255, 255, 80),
                    glow=((190, 205, 255), 0.30), grid=('grid', 28)),
    'ko':      dict(fill=((44, 56, 190, 180), (110, 44, 160, 170)), tier=18, line=(233, 225, 255, 215), steps=(233, 225, 255, 85),
                    glow=((122, 60, 255), 0.55), grid=('topo', 30)),
}


def find_src(src_dir, names):
    for n in names:
        for f in (n + '_radar_psd.png', n + '_radar.png', n + '.png', n + '_radar_tga.png'):
            p = os.path.join(src_dir, f)
            if os.path.isfile(p):
                return p
    return None


def walk_mask(im):
    """Walkable area of an overview picture: not background (transparent, black or white), without thin lines and labels."""
    a = np.asarray(im.convert('RGBA')).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    bg = (alpha < 40) | (lum < 10) | ((lum > 245) & (sat < 8))
    m = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    # opening removes the thin edge grid, zone letters and stray pixels; closing fills the holes left by icons
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    return m, lum


def geometry(src):
    """Mask of the walkable area and height tiers 0..2 (blurred brightness of the source, so no texture survives)."""
    im = Image.open(src)
    if im.size != (SIZE, SIZE):
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    mask, lum = walk_mask(im)
    mk = np.asarray(mask) > 127
    L = Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(8))
    l = np.asarray(L).astype(np.float32)
    if mk.any():
        lo, hi = np.percentile(l[mk], 5), np.percentile(l[mk], 95)
        t = np.clip((l - lo) / max(1.0, hi - lo), 0, 1)
    else:
        t = np.zeros_like(l)
    tier = Image.fromarray((np.floor(t * 2.999) * 100).astype(np.uint8)).filter(ImageFilter.ModeFilter(11))
    return mask, np.asarray(tier).astype(np.float32) / 100


def solid(rgba):
    return Image.new('RGBA', (SIZE, SIZE), tuple(rgba))


def paint(mask, tier, th):
    c = THEMES[th]
    y = np.linspace(0, 1, SIZE, dtype=np.float32)[:, None]
    (r0, r1) = [np.array(v, np.float32) for v in c['fill']]
    floor = r0[None, None, :] * (1 - y)[..., None] + r1[None, None, :] * y[..., None]
    floor = np.repeat(floor, SIZE, axis=1) if floor.shape[1] == 1 else floor
    floor[..., :3] += (tier * c['tier'])[..., None]
    floor[..., 3] = np.minimum(255, floor[..., 3] + tier * 12)
    fl = Image.fromarray(np.clip(floor, 0, 255).astype(np.uint8), 'RGBA')
    # height steps: thin lines where the tier changes (stairs, ledges)
    T = Image.fromarray((tier * 120).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)
    fl = Image.composite(solid(c['steps'][:3] + (255,)), fl, ImageChops.multiply(T.point(lambda v: c['steps'][3] if v > 30 else 0), mask))
    # light grid (classic, glass) or topographic waves like the ko HUD panels
    g = Image.new('L', (SIZE, SIZE), 0); d = ImageDraw.Draw(g)
    kind, ga = c['grid']
    if kind == 'grid':
        for k in range(0, SIZE, GRID):
            d.line([(k, 0), (k, SIZE)], fill=ga); d.line([(0, k), (SIZE, k)], fill=ga)
    else:
        xs = np.arange(0, SIZE + 8, 8)
        for k in range(-40, SIZE + 40, 26):
            pts = [(float(x), k + 9 * np.sin(x / 70 + k / 37) + 5 * np.sin(x / 23)) for x in xs]
            d.line(pts, fill=ga, width=1)
    fl = Image.composite(solid((255, 255, 255, 255)), fl, ImageChops.multiply(g, mask))
    out = solid((0, 0, 0, 0))
    gc, gs = c['glow']
    glow = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * gs))
    out = Image.composite(solid(gc + (255,)), out, glow)
    out = Image.composite(fl, out, mask) if th == 'classic' else Image.alpha_composite(out, Image.composite(fl, solid((0, 0, 0, 0)), mask))
    edge = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(3)), mask.filter(ImageFilter.MinFilter(3)))
    out = Image.composite(solid(c['line'][:3] + (255,)), out, edge.point(lambda v: c['line'][3] if v > 60 else 0))
    return out


def calib(spec):
    (w1, p1), (w2, p2) = [[tuple(map(float, s.split(','))) for s in part.split('=')] for part in spec.split(';')]
    sx = (w2[0] - w1[0]) / (p2[0] - p1[0]); sy = (w1[1] - w2[1]) / (p2[1] - p1[1])
    s = (sx + sy) / 2
    return {'x': round(w1[0] - p1[0] * s, 1), 'y': round(w1[1] + p1[1] * s, 1), 's': round(s, 4), 'skew': round(abs(sx - sy) / s, 4)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('maps', nargs='*')
    ap.add_argument('--src', default=None)
    ap.add_argument('--out', default=os.path.join(ROOT, 'web', 'shared', 'radar'))
    ap.add_argument('--quality', type=int, default=60)
    ap.add_argument('--size', type=int, default=768, help='output side in pixels (calibration is in fractions, any size works)')
    ap.add_argument('--themes', nargs='*', choices=list(THEMES), help='only these HUD themes (default: all three)')
    ap.add_argument('--calib', nargs=2, metavar=('MAP', 'POINTS'))
    a = ap.parse_args()
    if a.calib:
        print(a.calib[0], calib(a.calib[1])); return 0
    src_dir = a.src or next((d for d in (os.path.join(ROOT, 'cs2maps'), os.path.join(ROOT, 'radar-src')) if os.path.isdir(d)), None)
    if not src_dir:
        print('no source folder: put the overview pictures into cs2maps/ or radar-src/, or pass --src'); return 1
    os.makedirs(a.out, exist_ok=True)
    done = 0
    for m in a.maps or MAPS:
        src = find_src(src_dir, MAPS.get(m, [m]))
        if not src:
            if a.maps: print(m, ': no source picture')
            continue
        mask, tier = geometry(src)
        sizes = []
        for th in (a.themes or THEMES):
            out = os.path.join(a.out, f'{m}-{th}.webp')
            paint(mask, tier, th).resize((a.size, a.size), Image.LANCZOS).save(out, 'WEBP', quality=a.quality, method=6)
            sizes.append(f'{th} {os.path.getsize(out) // 1024} KB')
        print(f'{m}: {os.path.basename(src)} -> {os.path.relpath(a.out, ROOT)}/{m}-<theme>.webp ({", ".join(sizes)})'); done += 1
    print(done, 'maps')
    return 0 if done else 1


if __name__ == '__main__':
    sys.exit(main())
