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

## Optional: self-hosted analytics

rum1n8 ships with no analytics by default. If you want to see basic usage data, you can add a self-hosted [Umami](https://umami.is/) stack alongside the base deployment.

Two build-time env vars turn analytics on in the app:

```bash
VITE_UMAMI_SCRIPT_URL=https://analytics.yourdomain.com/script.js
VITE_UMAMI_WEBSITE_ID=00000000-0000-0000-0000-000000000000
```

When both are set at build time:

- the app loads the Umami tracker and records pageviews
- a handful of custom events are emitted (app opens, verse additions, reviews, install prompt clicks, onboarding dismissals)
- the privacy page is rewritten to disclose privacy-friendly self-hosted analytics

When either is missing, the base build contains no analytics script and the privacy page keeps the default no-analytics wording.

Users can opt out from the app's Settings modal at any time. Opt-out state is persisted in browser storage and blocks both pageview and custom event emission.

The overlay compose file `docker-compose.analytics.yml` defines a `umami` service and a `umami-db` PostgreSQL service. To run it alongside the base stack:

```bash
# in .env, set
UMAMI_DB_PASSWORD=replace-with-a-long-random-password
UMAMI_APP_SECRET=replace-with-a-long-random-string

docker compose -f docker-compose.yml -f docker-compose.analytics.yml up -d
```

Umami listens on host port `3002`. Put your reverse proxy in front of it so it is reachable at `https://analytics.yourdomain.com`, then set `VITE_UMAMI_SCRIPT_URL` to `https://analytics.yourdomain.com/script.js` and recreate the `rum1n8` container with the new build args so the tracker is baked into the build.

After the first startup, open `https://analytics.yourdomain.com`, sign in with the default admin account, create a website entry, and copy its ID into `VITE_UMAMI_WEBSITE_ID` before rebuilding the app container.

The base `docker-compose.yml` stack continues to work untouched without the overlay, so skipping analytics never blocks a deployment.

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
