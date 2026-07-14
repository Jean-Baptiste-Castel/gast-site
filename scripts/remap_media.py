#!/usr/bin/env python3
"""Remap every Squarespace-origin media item in src/data/projects.json to a
stored Cloudinary / Cloudflare Stream asset, per the HARD RULE (nothing may
reference Squarespace). Unresolved items become flagged grey blocks ('miss').

Inputs (all offline):
  - ../stream-list.json      full Stream inventory (FETCH-STREAM-LIST.command)
  - ../cloudinary-list.json  full stored-asset inventory (CHECK-CLOUDINARY.command)
  - ../home-grid/README.md   verified file->asset table (homepage migration)

Output: rewrites src/data/projects.json (backup kept) + MEDIA-MIGRATION-REPORT.md
"""
import json, re, sys, unicodedata, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
CODE = SITE.parent

def norm(name: str) -> str:
    """Normalize a filename for matching: unquote, strip ext, lower,
    collapse all non-alphanumerics."""
    n = urllib.parse.unquote(name)
    n = n.replace('+', ' ')
    n = re.sub(r'\.(png|jpe?g|webp|gif|mp4|mov)$', '', n, flags=re.I)
    n = unicodedata.normalize('NFC', n)
    return re.sub(r'[^a-z0-9一-鿿]+', '', n.lower())

# ── inventories ──────────────────────────────────────────────────────────
stream = json.load(open(CODE / 'stream-list.json'))
cloud = json.load(open(CODE / 'cloudinary-list.json'))

stream_by_norm, stream_by_prefix = {}, {}
for v in stream:
    if v.get('ready') and v['ready'] != 'ready':
        continue
    stream_by_norm.setdefault(norm(v['name']), v)
    m = re.match(r'([0-9a-f]{8})', v['name'])
    if m:  # June migration renamed many uploads "<squarespace-folder-prefix>-<desc>"
        stream_by_prefix.setdefault(m.group(1), v)

cl_img_by_norm, cl_vid_by_norm = {}, {}
for a in cloud:
    key = norm(a['id'].split('/')[-1])
    d = cl_img_by_norm if a['t'] == 'image' else cl_vid_by_norm
    d.setdefault(key, a)

# README verified table (file -> kind,id)
readme_db = {}
for line in open(CODE / 'home-grid' / 'README.md'):
    m = re.match(r'\|\s*\d+\s*\|\s*(Cloudinary video|Cloudflare Stream|Cloudinary image)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|', line)
    if m:
        served, aid, orig = m.groups()
        kind = {'Cloudinary video': 'clvid', 'Cloudflare Stream': 'cf', 'Cloudinary image': 'cli'}[served]
        readme_db[norm(orig)] = (kind, aid.replace('.mp4', '') if kind == 'clvid' else aid)

# ── remap ────────────────────────────────────────────────────────────────
pj = SITE / 'src' / 'data' / 'projects.json'
data = json.loads(pj.read_text())
report, stats = [], {'cli': 0, 'cf': 0, 'clvid': 0, 'miss': 0, 'kept': 0}

for slug, p in data['projects'].items():
    p.pop('og', None)  # og images were Squarespace URLs
    for it in p['items']:
        t = it.get('t')
        if t not in ('s', 'g', 'sqvid'):
            stats['kept'] += 1
            continue
        u = it.get('u') or ''
        folder, _, fn = u.partition('/')
        fname = urllib.parse.unquote(fn) or f'{slug} native video'
        key = norm(fname)
        hit = None
        if key in readme_db and not (t in ('g', 'sqvid') and readme_db[key][0] == 'cli'):
            hit = readme_db[key]
        elif t == 's' and key in cl_img_by_norm:
            hit = ('cli', cl_img_by_norm[key]['id'])
        elif t in ('g', 'sqvid'):
            v = stream_by_norm.get(key) or stream_by_prefix.get(folder[:8])
            if v:
                hit = ('cf', v['uid'])
                if v.get('w') and v.get('h'):
                    it['d'] = f"{v['w']}x{v['h']}"
            elif key in cl_vid_by_norm:
                hit = ('clvid', cl_vid_by_norm[key]['id'])
        if hit:
            it['t'], it['id'] = hit
            it.pop('u', None)
            stats[hit[0]] += 1
        else:
            it['t'] = 'miss'
            it['name'] = fname
            it.pop('u', None)
            it.pop('id', None)
            stats['miss'] += 1
            report.append((slug, fname))

backup = pj.with_suffix('.json.pre-remap')
if not backup.exists():
    backup.write_text(pj.read_text())
pj.write_text(json.dumps(data, indent=1, ensure_ascii=False))

rep = ['# Media migration report', '',
       f"- stills -> stored Cloudinary: {stats['cli']}",
       f"- gifs/videos -> Cloudflare Stream: {stats['cf']}",
       f"- gifs/videos -> Cloudinary video: {stats['clvid']}",
       f"- already safe (untouched): {stats['kept']}",
       f"- **missing, shown as grey blocks: {stats['miss']}**", '']
if report:
    rep.append('## Files still needing re-upload (per project)')
    cur = None
    for slug, fname in report:
        if slug != cur:
            rep.append(f'\n### {slug}')
            cur = slug
        rep.append(f'- `{fname}`')
(SITE / 'MEDIA-MIGRATION-REPORT.md').write_text('\n'.join(rep) + '\n')
print(json.dumps(stats))
print('report -> gast-site/MEDIA-MIGRATION-REPORT.md')
