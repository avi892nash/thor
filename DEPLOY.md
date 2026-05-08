# Thor Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Internet                           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Cloudflare CDN  │   (proxied DNS, edge cache)
                  └──────────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │ thor-api.devshram.com  │
                │     (DietPi / RPi)     │
                │  thor-server .deb      │
                │  ├─ Express API        │
                │  └─ React SPA (public/)│
                └────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │    WiZ Bulbs     │
                  │ (Local Network)  │
                  └──────────────────┘
```

A single `.deb` artifact contains both the server and the React build. Express serves the SPA from `/usr/lib/thor-server/public/` at the same origin as the API. Cloudflare caches static assets at the edge — content-hashed filenames make cache invalidation automatic on each deploy.

---

## Server Deployment (.deb package)

### First install

```bash
curl -fsSL https://github.com/avi892nash/thor/releases/latest/download/thor-api.deb \
  -o /tmp/thor.deb
sudo apt install /tmp/thor.deb
```

- Creates system user `thor`
- Installs server bundle to `/usr/lib/thor-server/dist/server.cjs`
- Installs React build to `/usr/lib/thor-server/public/`
- Config at `/etc/thor-server/.env` (preserved on upgrade)
- Data at `/etc/thor-server/data/rooms.json` (never overwritten on upgrade)
- Starts `thor-server.service` on port `3001`
- Enables `thor-update.timer` (checks for updates every 5 min)

### Auto-update flow

Every 5 minutes, `thor-update.timer` runs `thor-server-update`:
1. Fetches `releases/latest` from the GitHub API
2. Compares the release `tag_name` against `/var/lib/thor-server/installed-tag`
3. If different: downloads the `thor-api.deb` asset and runs `apt install`
4. Records the new tag in `/var/lib/thor-server/installed-tag`
5. The service restarts automatically via `postinst`

Frontend and backend update together — they always ship as one artifact.

### Config

Edit `/etc/thor-server/.env` to change any setting:

```ini
NODE_ENV=production
PORT=3001
DATA_DIR=/etc/thor-server/data
LOG_DIR=/var/log/thor-server
PUBLIC_DIR=/usr/lib/thor-server/public
JWT_SECRET=<generated at install>
```

After editing: `sudo systemctl restart thor-server`

### Useful commands

```bash
systemctl status thor-server            # service status
journalctl -u thor-server -f            # live logs
systemctl status thor-update.timer      # auto-update timer
sudo thor-server-update                 # force update check now
cat /etc/thor-server/.env               # view config
```

---

## Cloudflare setup

DNS for `devshram.com` is on Cloudflare. To make the SPA edge-cached:

1. **Proxy `thor-api.devshram.com`** — set the DNS record to "Proxied" (orange cloud). Cloudflare now sits in front of the Pi.
2. **Cache rules** for the zone:
   - `URI Path starts with /static/` → Edge TTL 1 year, Browser TTL 1 year (CRA's hashed assets are immutable).
   - `URI Path eq /` (or `/index.html`) → Bypass cache, or short Edge TTL (~30s). The HTML must reflect new releases promptly.
   - `URI Path starts with /api/` or `/auth/` or `/health` → Bypass cache. API responses must hit the origin.

The server already returns the right `Cache-Control` headers per file type, so Cloudflare honors them by default — explicit Cache Rules are belt-and-suspenders.

### Optional: redirect on bare API host

If you want browser visits to `thor-api.devshram.com/` to land on the SPA, no extra rule is needed — `/` returns `index.html` from the same origin. The SPA is the API's "/".

---

## Frontend Deployment (CI/CD)

Push to `main` triggers `.github/workflows/ci.yml`:

1. **build-frontend** — `npm run build` produces `frontend/build/` with content-hashed assets.
2. **build-server** — bundles `server.cjs` with esbuild, then stages everything (server bundle + frontend build + systemd units + DEBIAN scripts) into a single `thor-api.deb`.
3. **test-deb** — installs the `.deb` in CI, runs the server, smoke-tests the API endpoints AND verifies that `GET /` returns the SPA HTML.
4. **release** — semantic-release bumps the version, tags, creates a GitHub release with `thor-api.deb` attached.

No S3, no CloudFront, no separate asset host. The Pi serves everything; Cloudflare caches it.

### Versioning

Each release attaches `thor-api.deb` to a GitHub release tagged `v{semver}`. The `thor-update.timer` on the Pi installs new versions automatically. To roll back, install an older `.deb` manually:

```bash
sudo apt install ./thor-api-1.2.7.deb   # downgrade
```

`/var/lib/thor-server/installed-tag` records the current version.

### Manual deploy

Go to **Actions → Thor CI/CD → Run workflow** to trigger a release without a code change.
