#!/bin/bash
# Publishes the wholesale order page to the live site (Cloudflare rebuilds automatically).
cd "$(dirname "$0")"
echo "=== Publishing wholesale page ==="
rm -f .git/index.lock
mkdir -p public/wholesale
cp "../wholesale-page/wholesale.html" "public/wholesale/index.html"
git add public/wholesale/index.html
git commit -m "Add unlisted wholesale order page at /wholesale (noindex)"
git push origin main && echo "" && echo ">>> SUCCESS: pushed. Cloudflare will deploy in ~1-2 minutes." || echo ">>> PUSH FAILED - see message above."
