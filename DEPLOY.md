# Thor Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────────┐
        │  devshram.com/    │   │  thor-api.devshram.in │
        │  projects/thor/   │   │    (DietPi / RPi)     │
        │  (S3 + CloudFront)│   │   thor-server .deb    │
        └───────────────────┘   └───────────────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │   WiZ Bulbs       │
                                │  (Local Network)  │
                                └───────────────────┘
```

---

## Server Deployment (.deb package)

### First install

```bash
curl -fsSL https://github.com/avi892nash/thor/releases/download/server-latest/thor-server_1.0.0_all.deb \
  -o /tmp/thor.deb
sudo apt install /tmp/thor.deb
```

- Creates system user `thor`
- Installs to `/usr/lib/thor-server/`
- Config at `/etc/thor-server/.env` (preserved on upgrade)
- Data at `/etc/thor-server/data/rooms.json` (never overwritten on upgrade)
- Starts `thor-server.service` on port `3001`
- Enables `thor-update.timer` (checks for updates every 5 min)

### Auto-update flow

Every 5 minutes, `thor-update.timer` runs `thor-server-update`:
1. Fetches the `server-latest` GitHub Release metadata
2. Compares commit SHA in release notes vs `/usr/lib/thor-server/dist/.version`
3. If different: downloads the new `.deb`, verifies SHA256, runs `apt install`
4. The service restarts automatically via `postinst`

### Config

Edit `/etc/thor-server/.env` to change any setting:

```ini
NODE_ENV=production
PORT=3001
THOR_API_KEY=<generated at install>
ALLOWED_ORIGINS=https://thor.devshram.in
FRONTEND_BASE_URL=https://devshram.com/projects/thor
DATA_DIR=/etc/thor-server/data
```

After editing: `sudo systemctl restart thor-server`

### Cloudflare Tunnel

```bash
sudo /opt/thor/repo/server/deploy/setup-cloudflare-tunnel.sh
```

Exposes port `3001` at your chosen subdomain (e.g. `thor-api.devshram.in`) without port forwarding.

### Useful commands

```bash
systemctl status thor-server            # service status
journalctl -u thor-server -f            # live logs
systemctl status thor-update.timer      # auto-update timer
sudo thor-server-update                 # force update check now
cat /etc/thor-server/.env               # view config / API key
```

---

## Frontend Deployment (S3 + CloudFront)

Push to `main` triggers the `deploy-frontend.yml` workflow when `frontend/` files change.

### What the workflow does

1. Builds the React app with `REACT_APP_VERSION` injected from `package.json`
2. Uploads static assets to `s3://devshram.com/projects/thor/v{version}/`
3. Generates a loader `index.html` that calls `GET /frontend` on the backend to fetch the versioned URL, then redirects
4. Uploads the loader to `s3://devshram.com/projects/thor/index.html`
5. Invalidates the CloudFront distribution at `/projects/thor/*`

### Versioning

- Each frontend release lives at a permanent versioned path (`/projects/thor/v1.0.0/`)
- The loader at `/projects/thor/` always points to the version the backend advertises via `GET /frontend`
- This keeps backend and frontend versions in sync

### Authentication

Uses AWS OIDC (no stored keys). The IAM role `avi89nash_s3_upload` is trusted by this repository.

### Manual deploy

Go to **Actions → Deploy Frontend → Run workflow**.
