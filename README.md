# rum1n8

A Progressive Web App for memorizing Bible verses using spaced repetition and progressive memorization techniques.

Hosted at https://rum1n8.unrau.xyz

## How It Works

**Spaced Repetition System**

Uses a modified SM-2 algorithm to schedule reviews at optimal intervals. Reviews start at 1 day and extend up to 90 days based on your performance. Each verse is graded 0-5 based on accuracy, and the algorithm automatically adjusts the next review date and ease factor.

**Progressive Learning (Learn → Memorize → Master)**

The app guides you through three memorization stages, each requiring 90% accuracy to advance:

- **Learn**: All words visible but muted. Type first letters to reveal and begin learning.
- **Memorize**: Every other word hidden. Type first letters of hidden words to practice recall.
- **Master**: All words hidden. Type first letters to reveal the complete verse from memory.

Once a verse is mastered, it enters the spaced repetition review cycle.

**First-Letter Typing**

Instead of typing complete words, you type just the first letter of each word to reveal it. This approach engages active recall while keeping the memorization process fast and efficient. The system supports hyphenated words (requiring first letter of each part) and includes fuzzy typing for adjacent QWERTY keys.

## Privacy & Data Storage

**Your data stays on your device.** All verses, progress, and review history are stored locally in your browser's storage. No cloud services or third-party servers are involved.

You can:
- **Backup manually** to a JSON file that you control
- **Sync with your own WebDAV server** (like Nextcloud) for multi-device access
- **Import from CSV** to migrate from other memorization apps



## How to import from biblememory.com

1. Use brave browser and open the collection you want to import via the web page.
2. Open Leo AI and use this prompt to convert the collection to CSV.
```
For the list of verses on this page, export to CSV. Map it to columns as follows

- Verse reference -> "Reference"
- Verse content -> "Content" (put quotations around the verse content)
- Bible version -> "Version" (OTHER is BSB)
- Due in x days -> "DaysUntilNextReview" (only add the number e.g., 54)
- Review every x months -> "Interval" (only add the number, and convert to number of days)

```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### E2E Tests

```bash
npx playwright install chromium   # First-time: install browsers
npm run test:e2e
```

## Hosting with Docker Compose

The app runs as three Docker containers: the main app (Nginx serving static files), a WebDAV proxy for sync, and Watchtower for automatic updates. Pre-built images are pulled from GitHub Container Registry.

### Prerequisites

- Docker and Docker Compose installed on your server
- A reverse proxy (e.g., Nginx, Caddy) for TLS termination, forwarding to port 1234

### Setup

```bash
git clone https://github.com/timunrau/rum1n8.git
cd rum1n8
docker compose up -d
```

That's it. The app is available at `http://localhost:1234`.

### Automatic Updates

Watchtower runs as a service in the compose stack and polls GitHub Container Registry every 60 seconds. When new images are available (pushed by GitHub Actions after tests pass), Watchtower automatically pulls them and recreates the containers. No manual intervention needed.

### Useful Commands

```bash
docker compose logs -f rum1n8            # App logs
docker compose logs -f webdav-proxy     # WebDAV proxy logs
docker compose logs -f watchtower       # Auto-update logs
docker compose ps                       # Running containers
docker compose down                     # Stop everything
```

### Troubleshooting

- If the app doesn't load, check the logs: `docker compose logs rum1n8`
- If WebDAV sync isn't working, check the proxy logs: `docker compose logs webdav-proxy`
- To completely reset: `docker compose down -v && docker compose up -d`
- To temporarily disable auto-updates: `docker compose stop watchtower`

## Technologies

- Vue.js 3
- Tailwind CSS
- Vite
- PWA Plugin

## WebDAV Sync Setup

This app supports two-way sync with WebDAV servers (like Nextcloud).

### For Nextcloud (Development)

Due to CORS restrictions, you'll need to use a proxy server for development:

1. **Start the proxy server** with your Nextcloud URL:
   ```bash
   NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:proxy
   ```

2. **Or run both the app and proxy together**:
   ```bash
   NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:all
   ```

3. **In the app settings**:
   - Enter your Nextcloud URL (e.g., `https://your-nextcloud.com/remote.php/webdav`)
   - Enter your username and password
   - Check "Use CORS Proxy"
   - The proxy URL should be `http://localhost:3001` (default)

### For Production

For production, you'll need to either:
- Configure your WebDAV server to allow CORS requests
- Use a server-side proxy
- Deploy the app from the same origin as your WebDAV server
