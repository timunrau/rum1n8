# Hosting Notes

Minimal notes for the current supported deployment path in this repo.

## Prerequisites

- Docker and Docker Compose on the host
- A reverse proxy for TLS termination, forwarding to port `1234`
- Optional Google OAuth credentials if you want Google Drive sync

## Deploy

```bash
git clone https://github.com/timunrau/rum1n8.git
cd rum1n8
cp .env.example .env
docker compose up -d
```

The app is exposed on `http://localhost:1234`.

## Production URL metadata

Set `VITE_SITE_URL` in `.env` to the exact public HTTPS origin for your deployment:

```bash
VITE_SITE_URL=https://yourdomain.com
```

The container uses this at startup to render:

- the canonical URL tag
- `og:url`
- absolute social image URLs
- `sitemap.xml`
- a `Sitemap:` line in `robots.txt`

If you leave `VITE_SITE_URL` unset, the app still builds and works, but search engines will not get the canonical URL or sitemap for that deployment.

After adding or changing `VITE_SITE_URL`, recreate the app container once so Docker applies the new environment:

```bash
docker compose up -d
```

After that, future Watchtower image updates keep using the same `VITE_SITE_URL` because the container already has it in its runtime configuration.

After deploying, verify that these URLs load successfully:

- `https://yourdomain.com/`
- `https://yourdomain.com/robots.txt`
- `https://yourdomain.com/sitemap.xml`

If you want Google to index the site, verify the domain in Google Search Console and submit `https://yourdomain.com/sitemap.xml`.

## Google Drive sync

If you want Google Drive sync, set `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET` in `.env`.

Your Google OAuth app should allow `https://yourdomain.com/gdrive-callback.html` as a redirect URI for the hosted app.

## Runtime notes

- The `rum1n8` container serves the app through Nginx
- The `webdav-proxy` container handles `/api/webdav`
- `watchtower` polls GitHub Container Registry every 60 seconds and restarts the app containers when new images are available

## Useful commands

```bash
docker compose logs -f rum1n8
docker compose logs -f webdav-proxy
docker compose logs -f watchtower
docker compose ps
docker compose down
```

## Related docs

- [User overview](../README.md)
- [Developer notes](developer.md)
