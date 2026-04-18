#!/bin/bash
set -e

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "dev" ]; then
  echo "ERROR: Must be on the dev branch to prepare a release (currently on '$BRANCH')"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Uncommitted changes — commit or stash them first"
  exit 1
fi

node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const src = readFileSync('modules/utils.js', 'utf8');
const m = src.match(/export const VERSION = '([0-9]+)\.([0-9]+)'/);
if (!m) { console.error('ERROR: VERSION not found in modules/utils.js'); process.exit(1); }
const next = m[1] + '.' + (Number(m[2]) + 1);

const pnIdx = src.indexOf('export const PATCH_NOTES');
const pnSection = pnIdx !== -1 ? src.slice(pnIdx, pnIdx + 4000) : '';
if (!pnSection.includes("'" + next + "'")) {
  console.error('ERROR: No patch notes entry for v' + next);
  console.error("Add PATCH_NOTES['" + next + "'] to modules/utils.js first, then re-run.");
  process.exit(1);
}
writeFileSync('modules/utils.js', src.replace(m[0], "export const VERSION = '" + next + "'"));
console.log('Bumped to v' + next);
JSEOF

VERSION=$(node --input-type=module -e "import { VERSION } from './modules/utils.js'; process.stdout.write(VERSION)")
git add modules/utils.js
git commit -m "chore(release): bump to v$VERSION"

echo ""
echo "Ready! Push and open a PR:"
echo "  git push origin dev"
echo "  gh pr create --base master --title \"Release v$VERSION\""
