# Bible Memory PWA

A Progressive Web App for memorizing Bible verses using spaced repetition and progressive memorization techniques.

Hosted at https://bible-memory.unrau.xyz

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

Then combine all the verses into one verse and rename the reference to reflect that it's now a range of verses. For example Philippians 1:3-5

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

This app can be hosted using Docker Compose, which includes both the application and a WebDAV proxy server.

### Prerequisites

- Docker and Docker Compose installed on your server

### Initial Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd bible-memory
   ```


3. **Build and start the services**:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify the services are running**:
   ```bash
   docker-compose ps
   ```

The application will be available at `http://localhost:1234` (or your server's IP address).

### Updating After Pulling New Code

When you pull new code from git, you need to rebuild and restart the containers:

1. **Pull the latest code**:
   ```bash
   git pull
   ```

2. **Rebuild and restart the containers**:
   ```bash
   docker-compose up -d --build
   ```

   This command will:
   - Rebuild the Docker images with the new code
   - Restart the containers with the updated images
   - Run in detached mode (`-d`) so it continues running in the background

3. **Verify the update**:
   ```bash
   docker-compose ps
   docker-compose logs bible-memory
   ```

### Useful Docker Compose Commands

- **View logs**:
  ```bash
  docker-compose logs -f bible-memory
  docker-compose logs -f webdav-proxy
  ```

- **Stop the services**:
  ```bash
  docker-compose down
  ```

- **Restart without rebuilding**:
  ```bash
  docker-compose restart
  ```

- **View running containers**:
  ```bash
  docker-compose ps
  ```

### Troubleshooting

- If the app doesn't load, check the logs: `docker-compose logs bible-memory`
- If the WebDAV sync isn't working, check the proxy logs: `docker-compose logs webdav-proxy`
- To completely reset (removes containers and volumes):
  ```bash
  docker-compose down -v
  docker-compose up -d --build
  ```

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
