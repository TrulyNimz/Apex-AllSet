#!/usr/bin/env bash
# Apex Trading — VPS Bootstrap Script
# Tested on Ubuntu 22.04 LTS / 24.04 LTS
# Run as root: curl -fsSL <url>/bootstrap-vps.sh | sudo bash
set -euo pipefail

APEX_USER="apex"
APEX_DIR="/opt/apex"
COMPOSE_VERSION="2.29.7"

log()  { echo -e "\033[32m[APEX]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
die()  { echo -e "\033[31m[ERR]\033[0m $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Must run as root (use sudo)"

log "Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "Installing dependencies..."
apt-get install -y -qq \
  curl wget git ca-certificates gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  htop jq

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  systemctl enable --now docker
else
  log "Docker already installed: $(docker --version)"
fi

# ── Docker Compose plugin ─────────────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  log "Installing Docker Compose v${COMPOSE_VERSION}..."
  COMPOSE_BIN="/usr/local/lib/docker/cli-plugins/docker-compose"
  mkdir -p "$(dirname "$COMPOSE_BIN")"
  curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o "$COMPOSE_BIN"
  chmod +x "$COMPOSE_BIN"
else
  log "Docker Compose: $(docker compose version)"
fi

# ── Apex user ─────────────────────────────────────────────────────────────────
if ! id "$APEX_USER" &>/dev/null; then
  log "Creating user ${APEX_USER}..."
  useradd -m -s /bin/bash "$APEX_USER"
  usermod -aG docker "$APEX_USER"
fi

# ── App directory ─────────────────────────────────────────────────────────────
log "Creating app directory ${APEX_DIR}..."
mkdir -p "$APEX_DIR"
chown "$APEX_USER:$APEX_USER" "$APEX_DIR"

# ── Firewall ──────────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── Fail2ban ──────────────────────────────────────────────────────────────────
log "Enabling fail2ban..."
systemctl enable --now fail2ban

# ── Unattended upgrades ───────────────────────────────────────────────────────
log "Enabling automatic security updates..."
dpkg-reconfigure -plow unattended-upgrades

# ── System limits for high-connection WebSocket server ───────────────────────
log "Tuning system limits..."
cat > /etc/security/limits.d/apex.conf <<'EOF'
apex soft nofile 65536
apex hard nofile 65536
EOF

cat > /etc/sysctl.d/99-apex.conf <<'EOF'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
vm.overcommit_memory = 1
EOF
sysctl --system -q

# ── Deploy helper script ───────────────────────────────────────────────────────
cat > /usr/local/bin/apex-deploy <<'DEPLOY'
#!/usr/bin/env bash
# Usage: apex-deploy [tag]   — pulls latest images and restarts services
set -euo pipefail
TAG=${1:-latest}
cd /opt/apex
echo "[APEX] Pulling images (tag: ${TAG})..."
docker compose pull
echo "[APEX] Recreating containers..."
docker compose up -d --remove-orphans
echo "[APEX] Cleaning up old images..."
docker image prune -f
echo "[APEX] Deploy complete."
docker compose ps
DEPLOY
chmod +x /usr/local/bin/apex-deploy

log ""
log "========================================="
log " Bootstrap complete!"
log " Next steps:"
log "   1. Copy backend/.env to ${APEX_DIR}/.env"
log "   2. Copy backend/docker-compose.yml to ${APEX_DIR}/"
log "   3. Run: apex-deploy"
log "========================================="
