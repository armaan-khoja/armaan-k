#!/bin/sh
# Builds the site and publishes dist/ to the gh-pages branch, which GitHub Pages serves.
set -e
cd "$(dirname "$0")/.."
npm run build
origin="$(git remote get-url origin)"
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy site"
git push -q -f "$origin" gh-pages
rm -rf .git
echo "Published to gh-pages."
