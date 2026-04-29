# Thor

Smart home server for controlling Philips WiZ lights over your local network, with a React frontend and remote access via Cloudflare Tunnel.

## Server Install (DietPi / Raspberry Pi)

### Prerequisites

- Node.js 18+ (`sudo apt install nodejs`)
- `curl` and `apt`

### Install

```bash
curl -fsSL https://github.com/avi892nash/thor/releases/latest/download/thor-api.deb \
  -o /tmp/thor.deb
sudo apt install /tmp/thor.deb
```

The installer will:
- Create a `thor` system user
- Generate a random `JWT_SECRET` and save it to `/etc/thor-server/.env`
- Seed an empty `rooms.json` and `users.json` under `/etc/thor-server/data/`
- Start the `thor-server` systemd service on port `3001`
- Enable the auto-update timer

### First launch

Open the frontend and create your admin account. Once at least one account exists, registration is locked — only signed-in users can create more accounts (any user can; there are no roles). All users share the same `rooms.json` (one server = one home).

### Auto-update

The server checks GitHub Releases every 5 minutes and installs a new `.deb` automatically when a new version is available. No action needed.

### Useful commands

```bash
systemctl status thor-server            # service status
journalctl -u thor-server -f            # live server logs
sudo thor-server-update                 # force update check now
```

### Manual update

```bash
curl -fsSL https://github.com/avi892nash/thor/releases/latest/download/thor-api.deb \
  -o /tmp/thor.deb && sudo apt install /tmp/thor.deb
```

---

## Frontend Deploy (GitHub Actions → S3)

Push to `main` deploys automatically when `frontend/` files change.

The frontend is versioned — each release uploads to `s3://devshram.com/projects/thor/v{version}/` and a loader `index.html` at `projects/thor/index.html` fetches the correct version URL from the backend.
