#!/bin/bash
set -e
cd ~/forest-carbon-measurement

BEFORE=$(git rev-parse HEAD)
git pull --ff-only origin master >> ~/deploy.log 2>&1
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') no changes, skip restart" >> ~/deploy.log
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') new commit $AFTER, restarting..." >> ~/deploy.log

if ! git diff --quiet "$BEFORE" "$AFTER" -- package.json; then
  npm install --omit=dev --silent >> ~/deploy.log 2>&1
fi

pm2 restart forest-carbon >> ~/deploy.log 2>&1
echo "$(date '+%Y-%m-%d %H:%M:%S') deploy done" >> ~/deploy.log
