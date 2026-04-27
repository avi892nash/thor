# Thor

Smart home server for controlling Philips WiZ lights over your local network, with a React frontend and a Cloudflare Tunnel for remote access.

## Server Install (DietPi / Raspberry Pi)

### Prerequisites

- Node.js 18+ (`sudo apt install nodejs`)
- `curl` and `apt`

### Install

```bash
# Download the latest .deb from GitHub Releases
curl -fsSL https://github.com/avi892nash/thor/releases/download/server-latest/thor-server_1.0.0_all.deb \
  -o /tmp/thor.deb

# Install (apt handles dependencies)
sudo apt install /tmp/thor.deb
```

The installer will:
- Create a `thor` system user
- Generate a random API key and save it to `/etc/thor-server/.env`
- Seed an empty `rooms.json` at `/etc/thor-server/data/rooms.json`
- Start the `thor-server` systemd service on port `3001`
- Enable the auto-update timer

Your API key is printed at the end of the install — save it for the frontend config.

### Auto-update

The server checks GitHub Releases every 5 minutes and installs a new `.deb` automatically when a new version is available. No action needed.

### Cloudflare Tunnel (remote access)

To expose the server over the internet without port forwarding, run the tunnel setup script after installing:

```bash
sudo /opt/thor/repo/server/deploy/setup-cloudflare-tunnel.sh
```

You'll be prompted for your Cloudflare API token, tunnel name, and public subdomain.

### Useful commands

```bash
systemctl status thor-server            # service status
journalctl -u thor-server -f            # live server logs
cat /etc/thor-server/.env               # view config / API key
sudo thor-server-update                 # force update check now
```

### Manual update

```bash
curl -fsSL https://github.com/avi892nash/thor/releases/download/server-latest/thor-server_1.0.0_all.deb \
  -o /tmp/thor.deb && sudo apt install /tmp/thor.deb
```

---

## Frontend Deploy (GitHub Actions → S3)

Push to `main` deploys automatically when `frontend/` files change.

The frontend is versioned — each release uploads to `s3://devshram.com/projects/thor/v{version}/` and a loader `index.html` at `projects/thor/index.html` fetches the correct version URL from the backend.
