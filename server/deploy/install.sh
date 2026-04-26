#!/bin/bash

# Thor Server - One-shot install script
#
# Usage:
#   sudo -E ./install.sh
#
# Required env vars (or will be prompted):
#   CF_API_TOKEN   - Cloudflare API token (Tunnel:Edit + DNS:Edit)
#   CF_TUNNEL_NAME - e.g. thor-api
#   CF_SUBDOMAIN   - e.g. thor-api.devshram.in
#
# Optional env vars:
#   ALLOWED_ORIGINS - comma-separated frontend URLs (default: https://thor.devshram.in)
#   NODE_VERSION    - Node.js major version (default: 20)

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
step() { echo -e "${CYAN}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$EUID" -ne 0 ] && fail "Run as root: sudo -E ./install.sh"

# ── Prompt for any missing values ─────────────────────────────────────────────
ask() {
    local var="$1" prompt="$2" default="$3"
    if [ -z "${!var}" ]; then
        if [ -n "$default" ]; then
            read -rp "$prompt [$default]: " val
            printf -v "$var" '%s' "${val:-$default}"
        else
            read -rp "$prompt: " val
            [ -z "$val" ] && fail "$var is required"
            printf -v "$var" '%s' "$val"
        fi
    fi
}

REPO_URL="https://github.com/avi892nash/thor.git"
ask CF_API_TOKEN   "Cloudflare API token (Tunnel:Edit + DNS:Edit)" ""
ask CF_TUNNEL_NAME "Cloudflare tunnel name"           "thor-api"
ask CF_SUBDOMAIN   "Public subdomain (e.g. thor-api.devshram.in)"  ""
ask ALLOWED_ORIGINS    "Frontend URL (CORS origin)"      "https://thor.devshram.in"
ask FRONTEND_BASE_URL  "Frontend base URL (S3/CF path)"  "https://devshram.com/projects/thor"

NODE_VERSION="${NODE_VERSION:-20}"
APP_DIR="/opt/thor"
APP_USER="thor"
APP_NAME="thor-server"

echo ""
echo "========================================="
echo "  Thor Server Install"
echo "========================================="
log "Repo:     $REPO_URL"
log "Tunnel:   $CF_TUNNEL_NAME → https://$CF_SUBDOMAIN"
log "Origins:  $ALLOWED_ORIGINS"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
step "Updating system and installing dependencies..."
apt-get update -qq
apt-get install -y -qq curl git build-essential

# ── 2. Node.js ────────────────────────────────────────────────────────────────
step "Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
    log "Node $(node -v) installed"
else
    log "Node already installed: $(node -v)"
fi

# ── 3. App user + directory ───────────────────────────────────────────────────
step "Setting up app user and directory..."
id "$APP_USER" &>/dev/null || useradd -r -s /bin/false -d "$APP_DIR" "$APP_USER"
mkdir -p "$APP_DIR/data"

# ── 4. Clone or update repo ───────────────────────────────────────────────────
step "Cloning repository..."
if [ -d "$APP_DIR/repo/.git" ]; then
    log "Repo exists — pulling latest..."
    cd "$APP_DIR/repo" && git fetch origin && git reset --hard origin/main
else
    git clone "$REPO_URL" "$APP_DIR/repo"
fi

# ── 5. Build ──────────────────────────────────────────────────────────────────
step "Building server..."
cd "$APP_DIR/repo/server"
npm ci --production=false
npm run build

cp -r dist/* "$APP_DIR/"
cp package.json package-lock.json "$APP_DIR/"

cd "$APP_DIR"
npm ci --production

[ -f "$APP_DIR/repo/server/data/rooms.json" ] && \
    cp "$APP_DIR/repo/server/data/rooms.json" "$APP_DIR/data/rooms.json"

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod -R 755 "$APP_DIR"

# ── 6. API key ────────────────────────────────────────────────────────────────
API_KEY_FILE="$APP_DIR/.api_key"
if [ ! -f "$API_KEY_FILE" ]; then
    step "Generating API key..."
    API_KEY=$(openssl rand -hex 32)
    echo "$API_KEY" > "$API_KEY_FILE"
    chmod 600 "$API_KEY_FILE"
    chown "$APP_USER:$APP_USER" "$API_KEY_FILE"
else
    API_KEY=$(cat "$API_KEY_FILE")
    log "Using existing API key"
fi

# ── 7. Write .env (used by both systemd service and update script) ────────────
step "Writing /opt/thor/.env..."
cat > "$APP_DIR/.env" << EOF
NODE_ENV=production
PORT=3001
THOR_API_KEY=${API_KEY}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
FRONTEND_BASE_URL=${FRONTEND_BASE_URL}
EOF
chmod 600 "$APP_DIR/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"

# ── 8. Systemd service ────────────────────────────────────────────────────────
step "Creating systemd service..."
cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=Thor Smart Home Server
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"

sleep 3
systemctl is-active --quiet "$APP_NAME" && log "Server is running" || fail "Server failed to start — check: journalctl -u $APP_NAME -f"

# ── 9. Cloudflare Tunnel ──────────────────────────────────────────────────────
step "Setting up Cloudflare Tunnel..."

ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
case "$ARCH" in
    armhf|arm64|aarch64) CF_ARCH="arm64" ;;
    amd64|x86_64)        CF_ARCH="amd64" ;;
    *) fail "Unsupported architecture: $ARCH" ;;
esac

if ! command -v cloudflared &>/dev/null; then
    log "Downloading cloudflared ($CF_ARCH)..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH.deb" -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
fi

export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"

# Verify token
cloudflared tunnel list &>/dev/null || fail "Cloudflare API token invalid — check Tunnel:Edit + DNS:Edit permissions"

# Create tunnel if it doesn't exist
if cloudflared tunnel list | grep -q "$CF_TUNNEL_NAME"; then
    warn "Tunnel '$CF_TUNNEL_NAME' already exists"
else
    cloudflared tunnel create "$CF_TUNNEL_NAME"
    log "Tunnel created"
fi

TUNNEL_ID=$(cloudflared tunnel list | grep "$CF_TUNNEL_NAME" | awk '{print $1}')

# DNS route
cloudflared tunnel route dns "$CF_TUNNEL_NAME" "$CF_SUBDOMAIN" 2>/dev/null || warn "DNS route may already exist"

# Config
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: $CF_SUBDOMAIN
    service: http://localhost:3001
  - service: http_status:404
EOF

cloudflared service install
systemctl enable cloudflared
systemctl restart cloudflared

sleep 3
systemctl is-active --quiet cloudflared && log "Cloudflare tunnel running" || fail "Tunnel failed — check: journalctl -u cloudflared -f"

# ── 10. Auto-update cron ──────────────────────────────────────────────────────
step "Setting up auto-update (every 5 min)..."
UPDATE_SCRIPT="$APP_DIR/repo/server/deploy/update.sh"
echo "*/5 * * * * root $UPDATE_SCRIPT >> /var/log/thor-update.log 2>&1" > /etc/cron.d/thor-update
chmod 644 /etc/cron.d/thor-update
log "Cron job installed"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo -e "${GREEN}  INSTALL COMPLETE!${NC}"
echo "========================================="
echo ""
echo -e "  API:      ${CYAN}https://$CF_SUBDOMAIN${NC}"
echo -e "  API Key:  ${YELLOW}$API_KEY${NC}"
echo ""
echo "Add these to GitHub Secrets:"
echo "  API_URL   = https://$CF_SUBDOMAIN"
echo "  API_KEY   = $API_KEY"
echo ""
echo "Useful commands:"
echo "  journalctl -u $APP_NAME -f      # server logs"
echo "  journalctl -u cloudflared -f    # tunnel logs"
echo "  tail -f /var/log/thor-update.log # update logs"
echo ""
