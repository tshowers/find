#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was deployed." >&2' ERR

echo "Running Find production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Running unit tests..."
npm run test:ci

echo "Building the production Find bundle..."
npm run build

echo "Deploying Find to Firebase Hosting site todd-find..."
firebase deploy --project taliferrotech --only hosting:todd-find

echo "Find hosting deploy complete."
firebase projects:list
