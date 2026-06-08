#!/usr/bin/env bash
# Redéploie l'app sur le NAS (build + copie vers le dossier servi par Caddy).
# Usage : ./nas/deploy-app.sh
set -e

NAS=Julien@192.168.1.64
DEST=/volume1/docker/n8n_data/caddy_data/garde-manger

cd "$(dirname "$0")/.."

echo "→ build…"
npm run build

echo "→ copie vers le NAS…"
tar czf - -C dist . | ssh "$NAS" \
  "sudo rm -rf $DEST && sudo mkdir -p $DEST && sudo tar xzf - -C $DEST \
   && sudo find $DEST -name '._*' -delete \
   && sudo chmod -R a+rX $DEST && echo OK"

echo "✓ App déployée sur https://food.graphikeo.com"
