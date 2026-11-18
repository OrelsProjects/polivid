#!/usr/bin/env bash
# Runs on the worker instance (as root, through SSM) after scripts/deploy-worker.sh has unpacked
# a release into /opt/polivid/releases/<sha>. Installs it, fetches the env, and switches the service over.
#
#   release.sh <sha> <region>
set -euo pipefail
SHA="$1"
REGION="$2"
RELEASE="/opt/polivid/releases/$SHA"
ENV_PARAM="/polivid/worker/env"

log() { echo "[release $SHA] $*"; }

[[ -d "$RELEASE" ]] || { echo "No release at $RELEASE"; exit 1; }
chown -R polivid:polivid "$RELEASE"

log "Fetching the environment"
umask 077
aws ssm get-parameter --region "$REGION" --name "$ENV_PARAM" --with-decryption --query Parameter.Value --output text > /etc/polivid/worker.env.new
chown root:polivid /etc/polivid/worker.env.new
chmod 640 /etc/polivid/worker.env.new
mv /etc/polivid/worker.env.new /etc/polivid/worker.env
umask 022

log "Installing dependencies"
# prisma generate (postinstall) reads DATABASE_URL from prisma.config.ts but never connects.
sudo -u polivid -H env DATABASE_URL="postgresql://build@localhost:5432/build" \
  npm ci --include=dev --no-audit --no-fund --prefix "$RELEASE"

log "Downloading the headless browser for Remotion"
sudo -u polivid -H bash -c "cd '$RELEASE' && npx --no-install remotion browser ensure"

log "Checking the worker loads"
sudo -u polivid -H bash -c "cd '$RELEASE' && set -a && . /etc/polivid/worker.env && set +a && node_modules/.bin/tsx --require ./scripts/server-only-stub.cjs scripts/worker.ts --dry-run"

log "Switching to this release"
ln -sfn "$RELEASE" /opt/polivid/current.new
mv -T /opt/polivid/current.new /opt/polivid/current
systemctl restart polivid-worker.service
sleep 5
systemctl is-active --quiet polivid-worker.service || { journalctl -u polivid-worker -n 50 --no-pager; exit 1; }

log "Keeping the three newest releases"
ls -1dt /opt/polivid/releases/* | tail -n +4 | xargs -r rm -rf

log "Live"
journalctl -u polivid-worker -n 5 --no-pager
