# Hosting Notes

rum1n8 deploys as three independently published application images:

- `ghcr.io/timunrau/rum1n8-app` serves the PWA on host port `1234`.
- `ghcr.io/timunrau/rum1n8-site` serves the static marketing site on host port `1235`.
- `ghcr.io/timunrau/rum1n8-proxy` serves WebDAV internally on port `3001`.

Watchtower follows `latest` for all three containers.

## Configuration boundaries

GitHub Actions builds these browser-visible values into the frontend images:

```text
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_CLIENT_SECRET
VITE_UMAMI_SCRIPT_URL
VITE_UMAMI_WEBSITE_ID
VITE_UMAMI_MARKETING_WEBSITE_ID
VITE_APP_URL
VITE_MARKETING_URL
```

The app URL must be `https://rum1n8.unrau.xyz/app/`. The marketing URL must be `https://ruminatebiblememory.com/`. Production builds reject missing, malformed, non-HTTPS, or incorrectly pathed values.

Only genuine infrastructure secrets belong in the server `.env`:

```text
UMAMI_DB_PASSWORD
UMAMI_APP_SECRET
```

Frontend URLs and analytics website IDs do not need to be duplicated on the server after images have been built by GitHub Actions.

## Reverse proxy

Create two ordinary TLS-enabled Proxy Hosts in Nginx Proxy Manager:

```text
rum1n8.unrau.xyz          -> server:1234
ruminatebiblememory.com   -> server:1235
```

Force HTTPS for both. Do not add advanced Nginx configuration or path routing; each domain maps to one frontend container.

## Optional analytics overlay

The analytics overlay remains independent of the frontend containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.analytics.yml up -d
```

Set `UMAMI_DB_PASSWORD` and `UMAMI_APP_SECRET` in the server `.env`. Create separate Umami website entries for the app and marketing origins, then put their IDs in the corresponding GitHub Actions secrets.

App users control app analytics from Settings. Marketing visitors control the marketing-origin preference on `/privacy/`; the preferences are intentionally independent.

## Google Drive

Keep the existing OAuth redirect URI:

```text
https://rum1n8.unrau.xyz/gdrive-callback.html
```

The callback is served by the app container on the app domain.

## Routine operations

```bash
docker compose ps
docker compose logs -f rum1n8-app
docker compose logs -f rum1n8-site
docker compose logs -f webdav-proxy
docker compose logs -f watchtower
```

## Related docs

- [Developer notes](developer.md)
- [Android TWA development](android-twa.md)
