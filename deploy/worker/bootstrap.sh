#!/usr/bin/env bash
# One-time setup for the PoliVid worker instance (Ubuntu 24.04). Runs as EC2 user data at first boot,
# and is safe to run again. Code arrives later through deploy/worker/release.sh.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

log() { echo "[bootstrap] $*"; }

# 2 GB of swap, so a Remotion render on a small instance slows down instead of being killed.
if ! swapon --show | grep -q /swapfile; then
  log "Adding swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Installing packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg ffmpeg unzip \
  fonts-noto-core fonts-noto-color-emoji \
  libnss3 libdbus-1-3 libatk1.0-0t64 libatk-bridge2.0-0t64 libasound2t64 libxrandr2 libxkbcommon0 \
  libxfixes3 libxcomposite1 libxdamage1 libgbm1 libcups2t64 libcairo2 libpango-1.0-0

if ! command -v node >/dev/null || [[ "$(node -v)" != v24* ]]; then
  log "Installing Node 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

if ! command -v aws >/dev/null; then
  log "Installing the AWS CLI"
  snap install aws-cli --classic
fi

id polivid >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/polivid --shell /usr/sbin/nologin polivid
mkdir -p /opt/polivid/releases /etc/polivid
chown -R polivid:polivid /opt/polivid
chmod 750 /etc/polivid

cat > /etc/systemd/system/polivid-worker.service <<'UNIT'
[Unit]
Description=PoliVid worker (videos and productions)
After=network-online.target
Wants=network-online.target
ConditionPathExists=/opt/polivid/current/scripts/worker.ts

[Service]
User=polivid
Group=polivid
WorkingDirectory=/opt/polivid/current
EnvironmentFile=/etc/polivid/worker.env
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=1280
ExecStart=/opt/polivid/current/node_modules/.bin/tsx --require ./scripts/server-only-stub.cjs scripts/worker.ts
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable polivid-worker.service
log "Done. Deploy code with scripts/deploy-worker.sh from your machine."
