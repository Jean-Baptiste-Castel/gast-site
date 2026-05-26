#!/bin/bash
# One-time script to push gast-site to GitHub
# Run from inside the gast-site folder:
#   cd CODE/gast-site && bash push-to-github.sh

cd "$(dirname "$0")"

git init
git add .
git commit -m "Initial commit: Astro site with about page"
git branch -M main
git remote add origin https://github.com/Jean-Baptiste-Castel/gast-site.git
git push -u origin main

echo ""
echo "Done! Your code is now at https://github.com/Jean-Baptiste-Castel/gast-site"
echo "You can delete this script now."
