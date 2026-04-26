# Thor Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────────┐
        │  thor.devshram.in │   │ thor-api.devshram.in  │
        │      (S3/CF)      │   │   (Raspberry Pi)      │
        │     Frontend      │   │      Backend          │
        └───────────────────┘   └───────────────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │   WiZ Bulbs       │
                                │  (Local Network)  │
                                └───────────────────┘
```

## Frontend Deployment (S3 + CloudFront)

### Prerequisites
- AWS Account
- S3 Bucket configured for static hosting
- (Optional) CloudFront distribution
- GitHub repository with Actions enabled

### GitHub Secrets Required

Set these in your repository Settings > Secrets and variables > Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJal...` |
| `S3_BUCKET` | S3 bucket name | `thor-frontend-devshram` |
| `API_URL` | Backend API URL | `https://thor-api.devshram.in` |
| `API_KEY` | API authentication key | `your-32-byte-hex-key` |
| `FRONTEND_URL` | Frontend URL | `https://thor.devshram.in` |
| `CLOUDFRONT_DISTRIBUTION_ID` | (Optional) CF distribution ID | `E1234567890` |

> **Note**: The `API_KEY` is generated during Raspberry Pi setup. Copy it from the setup output or from `/opt/thor/.api_key` on your Pi.

### GitHub Variables (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `ap-south-1` |

### Deployment

Frontend automatically deploys on push to `main` branch (when `frontend/` files change).

Manual deployment: Go to Actions > Deploy Frontend to S3 > Run workflow

---

## Server Deployment (Raspberry Pi + Cloudflare Tunnel)

### Prerequisites
- Raspberry Pi 4 (recommended) with Raspberry Pi OS
- Cloudflare account with your domain (devshram.in)
- SSH access to the Pi

### Quick Setup

1. **SSH into your Raspberry Pi:**
   ```bash
   ssh pi@your-pi-ip
   ```

2. **Clone and run setup scripts:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/thor.git
   cd thor/server/deploy

   # Step 1: Install and configure Thor server
   sudo ./setup-rpi.sh

   # Step 2: Setup Cloudflare Tunnel (exposes to internet)
   sudo ./setup-cloudflare-tunnel.sh
   ```

3. **During tunnel setup, you'll be asked for:**
   - Cloudflare login (browser will open)
   - Tunnel name (e.g., `thor-api`)
   - Subdomain (e.g., `thor-api.devshram.in`)

4. **Save the API key** shown at the end - you'll need it for frontend deployment.

### How Cloudflare Tunnel Works

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Frontend      │      │   Cloudflare     │      │  Raspberry Pi   │
│   (S3/CF)       │─────▶│   Edge Network   │◀─────│  (cloudflared)  │
│                 │      │                  │      │                 │
│ thor.devshram.in│      │ HTTPS/Security   │      │ localhost:3001  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                              ▲
                              │ Outbound connection
                              │ (no port forwarding needed!)
```

**Benefits:**
- No port forwarding on your router
- Automatic HTTPS (Cloudflare handles SSL)
- DDoS protection included
- Works behind NAT/CGNAT
- No static IP needed

### DNS Configuration

Cloudflare Tunnel automatically creates the DNS record. Just ensure your domain is on Cloudflare:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | thor-api | (auto-created by tunnel) | Proxied |

### Alternative: Manual Nginx Setup (if not using Cloudflare Tunnel)

<details>
<summary>Click to expand Nginx setup instructions</summary>

1. **Install Nginx and Certbot:**
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx -y
   ```

2. **Copy nginx config:**
   ```bash
   sudo cp /opt/thor/repo/server/deploy/nginx.conf /etc/nginx/sites-available/thor-api
   sudo ln -s /etc/nginx/sites-available/thor-api /etc/nginx/sites-enabled/
   ```

3. **Edit the config** to match your domain:
   ```bash
   sudo nano /etc/nginx/sites-available/thor-api
   ```

4. **Get SSL certificate:**
   ```bash
   sudo certbot --nginx -d thor-api.devshram.in
   ```

5. **Point DNS A record** to your Pi's public IP and forward port 443.

</details>

### Updating the Server

```bash
cd /opt/thor/repo/server/deploy
sudo ./update.sh
```

### Useful Commands

```bash
# View server logs
sudo journalctl -u thor-server -f

# Restart server
sudo systemctl restart thor-server

# Check server status
sudo systemctl status thor-server

# View tunnel logs
sudo journalctl -u cloudflared -f

# Check tunnel status
cloudflared tunnel info thor-api

# Restart tunnel
sudo systemctl restart cloudflared

# View API key
cat /opt/thor/.api_key
```

---

## Validation Checks

The CI/CD pipeline includes these checks:

1. **Build validation** - Ensures index.html and static assets exist
2. **Sensitive data check** - Scans for accidental secrets in build
3. **API health check** - Verifies backend is reachable before deploy

---

## Troubleshooting

### Frontend not loading
- Check S3 bucket policy allows public read
- Verify CloudFront invalidation completed
- Check browser console for CORS errors

### API connection issues
- Verify Raspberry Pi is accessible from internet
- Check nginx is running: `sudo systemctl status nginx`
- Verify SSL certificate: `sudo certbot certificates`
- Check firewall: `sudo ufw status`

### WiZ lights not responding
- Ensure Pi is on the same network as lights
- Check UDP port 38899 is not blocked
- Verify light IPs in rooms.json are correct
