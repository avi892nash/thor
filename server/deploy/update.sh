#!/bin/bash

# Thor Server - Update Script
# Run this script to update the server to the latest version

set -e

APP_NAME="thor-server"
APP_DIR="/opt/thor"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo ./update.sh)"
    exit 1
fi

log_info "Checking for updates..."

cd "$APP_DIR/repo"
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log_info "Already up to date ($LOCAL). Skipping build."
    exit 0
fi

log_info "New commits found: $LOCAL → $REMOTE"
git reset --hard origin/main

# Build server
log_info "Building server..."
cd "$APP_DIR/repo/server"
npm ci --production=false
npm run build

# Copy built files
cp -r dist/* "$APP_DIR/"
cp package.json "$APP_DIR/"
cp package-lock.json "$APP_DIR/"

# Install production dependencies
cd "$APP_DIR"
npm ci --production

# Set permissions
chown -R thor:thor "$APP_DIR"

# Restart service
log_info "Restarting service..."
systemctl restart $APP_NAME

# Wait and check
sleep 3
if systemctl is-active --quiet $APP_NAME; then
    log_info "Update complete! Server is running."
    curl -s http://localhost:3001/health
else
    log_error "Service failed to start after update!"
    journalctl -u $APP_NAME -n 20
    exit 1
fi
