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
