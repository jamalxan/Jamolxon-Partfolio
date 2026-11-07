#!/usr/bin/env bash
# One-time server bootstrap for jamolxon (idempotent). Run as root from a checkout:
#   bash infra/scripts/server-setup.sh "<ssh-ed25519 public key of the CI deploy key>" [--edge]
# --edge (dedicated server only): also runs Caddy (TLS) from infra/docker-compose.edge.yml on network jamolxon_edge.
# Creates only jamolxon-specific users, dirs, sudo rule and timers. Does not change sshd, UFW or other projects.
set -euo pipefail
CI_PUBKEY="${1:?CI public key required}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

apt-get install -y -qq age git curl >/dev/null

install -d -m 755 /opt/jamolxon /opt/jamolxon/production /opt/jamolxon/staging
install -d -m 700 /var/backups/jamolxon
for env in production staging; do
  [ -f "/opt/jamolxon/$env/.env" ] && chmod 600 "/opt/jamolxon/$env/.env"
done

install -m 755 "$HERE/scripts/deploy.sh" /usr/local/bin/jamolxon-deploy

# Deploy user: may only run jamolxon-deploy through sudo, via a forced-command key.
id jxdeploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/sh jxdeploy
install -d -o jxdeploy -g jxdeploy -m 700 /home/jxdeploy/.ssh
echo "command=\"sudo /usr/local/bin/jamolxon-deploy\",restrict $CI_PUBKEY" > /home/jxdeploy/.ssh/authorized_keys
chown jxdeploy:jxdeploy /home/jxdeploy/.ssh/authorized_keys
chmod 600 /home/jxdeploy/.ssh/authorized_keys
echo 'jxdeploy ALL=(root) NOPASSWD: /usr/local/bin/jamolxon-deploy' > /etc/sudoers.d/jamolxon-deploy
echo 'Defaults:jxdeploy env_keep += "SSH_ORIGINAL_COMMAND"' >> /etc/sudoers.d/jamolxon-deploy
chmod 440 /etc/sudoers.d/jamolxon-deploy
visudo -cf /etc/sudoers.d/jamolxon-deploy

install -m 644 "$HERE/systemd/jamolxon-backup@.service" "$HERE/systemd/jamolxon-backup@.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now jamolxon-backup@production.timer
if [ "${2:-}" = "--edge" ]; then
  docker network inspect jamolxon_edge >/dev/null 2>&1 || docker network create jamolxon_edge >/dev/null
  install -d -m 755 /opt/jamolxon/edge /opt/jamolxon/edge/sites
  install -m 644 "$HERE/caddy/Caddyfile" "$HERE/caddy/jamolxon.caddy" /opt/jamolxon/edge/
  docker compose -p jamolxon-edge -f "$HERE/docker-compose.edge.yml" up -d
  docker exec jamolxon-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null || true
fi
echo "setup ok"
