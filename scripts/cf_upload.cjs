#!/usr/bin/env node
/*
  Cloudflare Images bulk migration for the Gast site.
  Uploads every Squarespace still/gif (listed in src/data/_migrate_assets.json)
  straight from its Squarespace URL into your Cloudflare Images account, then writes
  src/data/_cf_map.json = { hash: "<account hash>", map: { "<squarespace path>": "<cf image id>" } }.

  After it finishes, tell Claude and it will repoint every page at Cloudflare and remove
  all Squarespace fetches.

  ----------------------------------------------------------------------------
  ONE-TIME SETUP (in your Cloudflare dashboard):
   1. Images -> make sure Images is enabled (Cloudflare Images plan, ~$5/mo).
   2. Images -> Variants -> turn ON "Flexible variants" (lets the site request sizes).
   3. Create an API token: My Profile -> API Tokens -> Create Token ->
      "Custom token" -> Permissions: Account > Cloudflare Images > Edit. Copy it.
   4. Copy your Account ID (Images page URL, or dashboard right sidebar).

  RUN (from the CODE/gast-site folder):
      CF_ACCOUNT_ID=xxxx CF_API_TOKEN=yyyy node scripts/cf_upload.cjs

  Safe to re-run: it skips anything already in _cf_map.json and resumes.
  ----------------------------------------------------------------------------
*/
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('Missing env vars. Run:\n  CF_ACCOUNT_ID=xxxx CF_API_TOKEN=yyyy node scripts/cf_upload.cjs');
  process.exit(1);
}

const SQ = 'https://images.squarespace-cdn.com/content/v1/6397a67a7842513d84ffeded/';
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'src/data/_migrate_assets.json');
const OUT = path.join(ROOT, 'src/data/_cf_map.json');
const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`;

// Cloudflare image id: keep it readable + unique. Slashes allowed; sanitize the rest.
function makeId(p) {
  return p.replace(/%[0-9a-fA-F]{2}/g, '-').replace(/[^A-Za-z0-9/_.-]/g, '-').replace(/-+/g, '-').slice(0, 900);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadOne(p) {
  const id = makeId(p);
  const fd = new FormData();
  fd.append('url', SQ + p);
  fd.append('id', id);
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}` }, body: fd });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.result) {
    let hash = '';
    const v = (json.result.variants || [])[0] || '';
    const mm = v.match(/imagedelivery\.net\/([^/]+)\//);
    if (mm) hash = mm[1];
    return { ok: true, id: json.result.id, hash };
  }
  // already exists -> treat as success (resumable)
  const errs = (json.errors || []).map((e) => e.code + ':' + e.message).join('; ');
  if (/already exists|5409|ERROR 5409/i.test(errs) || res.status === 409) return { ok: true, id, hash: '' };
  return { ok: false, error: errs || ('HTTP ' + res.status) };
}

(async () => {
  const assets = JSON.parse(fs.readFileSync(ASSETS, 'utf8'));
  let state = { hash: '', map: {} };
  if (fs.existsSync(OUT)) { try { state = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {} }
  let done = 0, failed = 0, skipped = 0;
  const fails = [];
  for (let i = 0; i < assets.length; i++) {
    const p = assets[i];
    if (state.map[p]) { skipped++; continue; }
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { r = await uploadOne(p); } catch (e) { r = { ok: false, error: e.message }; }
      if (r.ok) break;
      await sleep(800);
    }
    if (r.ok) {
      state.map[p] = r.id;
      if (r.hash && !state.hash) state.hash = r.hash;
      done++;
    } else {
      failed++; fails.push({ p, error: r.error });
    }
    if ((i + 1) % 10 === 0 || i === assets.length - 1) {
      fs.writeFileSync(OUT, JSON.stringify(state, null, 0));
      process.stdout.write(`\r${i + 1}/${assets.length}  uploaded:${done} skipped:${skipped} failed:${failed}   `);
    }
    await sleep(120);
  }
  fs.writeFileSync(OUT, JSON.stringify(state, null, 0));
  console.log('\n\nDone.');
  console.log('Account hash:', state.hash || '(not detected — check Images dashboard)');
  console.log('Mapped:', Object.keys(state.map).length, 'of', assets.length);
  if (fails.length) {
    console.log('\nFailures (' + fails.length + '):');
    fails.slice(0, 20).forEach((f) => console.log(' -', f.p, '=>', f.error));
    console.log('Re-run the same command to retry just the failures.');
  }
  console.log('\nWrote', path.relative(ROOT, OUT));
  console.log('Now tell Claude it is done and it will repoint the site to Cloudflare.');
})();
