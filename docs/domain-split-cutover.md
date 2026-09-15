# One-Time Domain Cutover

Use this runbook once to replace the original combined container with the app, marketing, and WebDAV containers. It accepts a short outage so the change can use ordinary Compose commands.

The order matters: run `docker compose down` while the old Compose file is still in place. That removes the old `rum1n8` container before the new `rum1n8-app` container claims host port `1234`.

## 1. Prepare the external services

Choose the marketing domain and point its DNS record at the production reverse proxy.

Create a separate Umami website for the marketing domain. In GitHub Actions, set:

| Secret | Value |
|---|---|
| `VITE_APP_URL` | `https://rum1n8.unrau.xyz/app/` |
| `VITE_MARKETING_URL` | `https://<marketing-domain>/` |
| `VITE_UMAMI_MARKETING_WEBSITE_ID` | Marketing Umami website ID |

Confirm that `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`, `VITE_UMAMI_SCRIPT_URL`, and `VITE_UMAMI_WEBSITE_ID` are still present.

Push the release commit and wait for the Deploy workflow to finish successfully. It tests immutable images before promoting the app, marketing, and proxy images to `latest`.

In Nginx Proxy Manager, leave the existing app Proxy Host unchanged and add the marketing Proxy Host:

| Setting | App | Marketing |
|---|---|---|
| Domain | `rum1n8.unrau.xyz` | `<marketing-domain>` |
| Scheme | `http` | `http` |
| Forward port | `1234` | `1235` |
| Force SSL | On | On |

No advanced Nginx configuration or path routing is needed.

## 2. Replace the stack

On the server, make a rollback copy of the old Compose file. Do not remove the old image yet.

```bash
cp docker-compose.yml docker-compose.before-domain-cutover.yml
docker compose down
```

Now replace `docker-compose.yml` with the version from the tested release. If the server is a Git checkout, this is normally:

```bash
git pull --ff-only
```

Start the new stack:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

All four services should start: `rum1n8-app`, `rum1n8-site`, `webdav-proxy`, and `watchtower`. The three application containers should become healthy.

Do not add `--volumes` to `docker compose down`. The app's user data is stored in each user's browser, not in the frontend container, but unrelated Compose volumes should still be preserved.

## 3. Verify the deployment

Check the containers directly:

```bash
curl -fsS http://127.0.0.1:1234/health
curl -fsS http://127.0.0.1:1235/health
docker compose logs --tail=100 rum1n8-app rum1n8-site webdav-proxy
```

Check the public app and PWA endpoints:

```bash
curl -fsSI https://rum1n8.unrau.xyz/app/
curl -fsSI https://rum1n8.unrau.xyz/manifest.webmanifest
curl -fsSI https://rum1n8.unrau.xyz/sw.js
curl -fsSI https://rum1n8.unrau.xyz/gdrive-callback.html
curl -fsSI https://rum1n8.unrau.xyz/.well-known/assetlinks.json
```

Check the marketing domain, canonical aliases, and legacy app bookmarks:

```bash
curl -fsSI https://<marketing-domain>/
curl -fsS https://<marketing-domain>/robots.txt
curl -fsS https://<marketing-domain>/sitemap.xml
curl -sSI 'https://<marketing-domain>/privacy.html?source=cutover'
curl -sSI 'https://rum1n8.unrau.xyz/?source=cutover'
curl -sSI 'https://rum1n8.unrau.xyz/?view=stats'
```

The expected redirects are:

- Marketing `/privacy.html?source=cutover` → `/privacy/?source=cutover`
- App-domain `/?source=cutover` → the marketing homepage with the query preserved
- App-domain `/?view=stats` → `/app/?view=stats`

Confirm that an unknown path on either domain returns `404`. Inspect the marketing page source for the production canonical URL, `og:url`, social image, and JSON-LD.

Finally, use the app normally and verify existing data, offline loading, the update prompt, Google Drive, WebDAV, Android launch, app-to-marketing links, return navigation, and Share App.

## 4. Roll back

If verification fails, stop the new stack and restore the old Compose file:

```bash
docker compose down
cp docker-compose.before-domain-cutover.yml docker-compose.yml
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:1234/health
```

This works because `docker compose down` does not delete the old image. Keep the backup Compose file and old image until the cutover has been accepted. The marketing Proxy Host may remain configured while the marketing container is unavailable, or it can be disabled in Nginx Proxy Manager during rollback.

## 5. Finish search setup

Verify the marketing domain in Google Search Console and submit:

```text
https://<marketing-domain>/sitemap.xml
```
