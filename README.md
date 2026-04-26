# Thor

Smart home server for controlling Philips WiZ lights over your local network, with a React frontend and a Cloudflare Tunnel for remote access.

## Server Install (DietPi / Raspberry Pi)

Run this on your device — it will ask for your Cloudflare details and set everything up:

```bash
curl -fsSL https://raw.githubusercontent.com/avi892nash/thor/main/server/deploy/install.sh | sudo bash
```

You'll be prompted for:

| Prompt | Example |
|---|---|
| Cloudflare API token | `your_token` (needs Tunnel:Edit + DNS:Edit) |
| Tunnel name | `thor-api` |
| Public subdomain | `thor-api.devshram.in` |
| Frontend URL (CORS) | `https://thor.devshram.in` |

After install the server auto-updates every 5 minutes by polling `main`.

### What it does

- Installs Node.js 20
- Clones the repo, builds the TypeScript server
- Creates a `thor-server` systemd service
- Sets up a Cloudflare Tunnel (no port forwarding needed)
- Adds a cron job to auto-pull and rebuild on new commits

### Useful commands

```bash
journalctl -u thor-server -f        # server logs
journalctl -u cloudflared -f        # tunnel logs
tail -f /var/log/thor-update.log    # auto-update logs
```

### Manual update

```bash
sudo /opt/thor/repo/server/deploy/update.sh
```

## Frontend Deploy (GitHub Actions → S3)

Add these secrets to your GitHub repo (**Settings → Secrets → Actions**):

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `S3_BUCKET` | e.g. `thor-frontend-devshram` |
| `API_URL` | `https://thor-api.devshram.in` |
| `API_KEY` | from `/opt/thor/.api_key` on the device |
| `FRONTEND_URL` | `https://thor.devshram.in` |
| `CLOUDFRONT_DISTRIBUTION_ID` | *(optional)* |

Push to `main` deploys automatically.
