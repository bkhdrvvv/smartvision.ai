#!/usr/bin/env bash
# SMARTVISION AI — one-time server setup (Ubuntu 22.04 / 24.04 VPS, run as root).
#   1) DNS: A records  smartvisionai.uz  and  www.smartvisionai.uz  → this server's IP
#   2) copy the project folder to /opt/smartvision (without node_modules, .next, .pgdata, .tools)
#   3) sudo bash /opt/smartvision/deploy/setup.sh
# Installs: Node.js 22, PostgreSQL (UTF-8), Caddy (automatic free HTTPS from Let's Encrypt),
# a firewall, the site as a system service and a daily backup.
set -euo pipefail

APP=/opt/smartvision
DOMAIN=${DOMAIN:-smartvisionai.uz}
DB=smartvision
DBUSER=smartvision

[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }
[ -f "$APP/package.json" ] || { echo "project not found in $APP"; exit 1; }

echo "== packages"
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw fail2ban postgresql debian-keyring debian-archive-keyring apt-transport-https
# Node.js 22 LTS
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
# Caddy (official repository)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "== firewall: only SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

echo "== app user"
id smartvision >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin smartvision

echo "== database (UTF-8 — emoji and every alphabet)"
if [ ! -f "$APP/.env" ]; then
  PW=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
  AUTH=$(openssl rand -base64 48 | tr -d '\n')
  cp "$APP/deploy/env.production.example" "$APP/.env"
  sed -i "s|__DB_PASSWORD__|$PW|; s|__AUTH_SECRET__|$AUTH|; s|__DOMAIN__|$DOMAIN|g" "$APP/.env"
  echo "   created $APP/.env — add SMTP, Google and Gemini keys from the old .env"
fi
PW=$(grep -oP '^DATABASE_URL="postgres://smartvision:\K[^@]+' "$APP/.env")
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DBUSER'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE $DBUSER LOGIN PASSWORD '$PW'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB OWNER $DBUSER ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0"

echo "== build"
cd "$APP"
mkdir -p uploads backups
chown -R smartvision:smartvision "$APP"
sudo -u smartvision npm ci
sudo -u smartvision npx prisma db push
sudo -u smartvision npx next build
if [ -f "$APP/backups/restore.json" ] && [ "$(sudo -u postgres psql -d $DB -tAc 'SELECT COUNT(*) FROM "User"')" = 0 ]; then
  echo "== restoring data from backups/restore.json"
  sudo -u smartvision node scripts/restore.cjs backups/restore.json
fi

echo "== services"
install -m 644 deploy/smartvision.service /etc/systemd/system/smartvision.service
install -m 644 deploy/smartvision-backup.service /etc/systemd/system/smartvision-backup.service
install -m 644 deploy/smartvision-backup.timer /etc/systemd/system/smartvision-backup.timer
sed "s/smartvisionai.uz/$DOMAIN/g" deploy/Caddyfile > /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl daemon-reload
systemctl enable --now smartvision smartvision-backup.timer
systemctl restart caddy

echo
echo "Done. https://$DOMAIN — the certificate is issued on the first visit (DNS must already point here)."
echo "Logs: journalctl -u smartvision -f    |    Backups: $APP/backups (daily, 14 kept)"
