import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import cors from 'cors'

const app = express()
const PORT = process.env.PROXY_PORT || 3001
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || ''

// Enable CORS for all routes with permissive settings for development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'],
  allowedHeaders: ['*']
}))

// Health check endpoint (must come before body parsing)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CORS proxy server is running', nextcloudUrl: NEXTCLOUD_URL || 'Not configured' })
})

// Don't parse body for proxy requests - let http-proxy-middleware handle it
// This is important for file uploads and WebDAV requests

// Proxy all other requests to Nextcloud
// The webdav client will make requests to paths like /remote.php/webdav/...
// We forward these to the configured Nextcloud URL
app.use((req, res, next) => {
  // Get target URL from custom header (per-request, highest priority), query parameter, or environment variable
  const headerTarget = req.headers['x-webdav-target']
  let targetUrl = (headerTarget && headerTarget.trim()) || req.query.target || NEXTCLOUD_URL
  
  // Debug logging
  console.log(`[Proxy] Request: ${req.method} ${req.path}`)
  console.log(`[Proxy] X-WebDAV-Target header: ${headerTarget || 'not set'}`)
  console.log(`[Proxy] Query target: ${req.query.target || 'not set'}`)
  console.log(`[Proxy] Env NEXTCLOUD_URL: ${NEXTCLOUD_URL || 'not set'}`)
  console.log(`[Proxy] Using target URL: ${targetUrl || 'not configured'}`)
  
  if (!targetUrl || !targetUrl.trim()) {
    return res.status(400).json({ 
      error: 'Nextcloud URL not configured. Set NEXTCLOUD_URL environment variable, use ?target=<url>, or send X-WebDAV-Target header',
      instructions: 'Example: NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:proxy'
    })
  }

  // Ensure target URL doesn't end with /
  targetUrl = targetUrl.replace(/\/$/, '')
  
  // Parse the target URL
  let target
  try {
    target = new URL(targetUrl)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid Nextcloud URL: ' + e.message })
  }

  // The request path from the client includes /api/webdav prefix that nginx forwarded
  // We need to strip that prefix and get the actual WebDAV path
  let requestPath = req.path === '/' ? '' : req.path
  
  // Strip /api/webdav prefix if present (nginx forwards the full path)
  if (requestPath.startsWith('/api/webdav')) {
    requestPath = requestPath.substring('/api/webdav'.length)
  }
  
  // If path is empty or root after stripping, use target pathname
  if (!requestPath || requestPath === '/') {
    requestPath = target.pathname
  } else {
    // Normalize paths for comparison (remove trailing slashes)
    const normalizedTargetPath = target.pathname.replace(/\/$/, '')
    const normalizedRequestPath = requestPath.replace(/\/$/, '')
    
    // Determine the target path to forward to Nextcloud
    if (normalizedRequestPath.startsWith(normalizedTargetPath)) {
      // Request path already includes the full Nextcloud path, use it directly
      // (no change needed)
    } else {
      // Request path is relative, combine with target pathname
      requestPath = normalizedTargetPath + (requestPath.startsWith('/') ? '' : '/') + requestPath
    }
  }
  
  const targetPath = requestPath
  
  // Debug logging
  console.log(`[Proxy] Target origin: ${target.origin}`)
  console.log(`[Proxy] Target pathname: ${target.pathname}`)
  console.log(`[Proxy] Original request path (req.path): ${req.path}`)
  console.log(`[Proxy] After stripping /api/webdav: ${requestPath}`)
  console.log(`[Proxy] Final target path: ${targetPath}`)
  console.log(`[Proxy] Forwarding to: ${target.origin}${targetPath}`)

  // Create proxy middleware
  const proxy = createProxyMiddleware({
    target: target.origin,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      // We've already processed the path, so just return the targetPath
      return targetPath
    },
    timeout: 60000, // 60 second timeout (increase for large uploads)
    proxyTimeout: 60000,
    // Increase body size limit for file uploads
    limit: '50mb',
    onProxyReq: (proxyReq, req) => {
      // Remove internal header so Nextcloud doesn't see it
      proxyReq.removeHeader('x-webdav-target')

      // Set longer timeout on the proxy request
      proxyReq.setTimeout(60000)
    },
    onProxyRes: (proxyRes, req, res) => {
      // Log non-2xx responses for debugging
      if (proxyRes.statusCode >= 400) {
        console.log(`[Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.path}`)
        console.log(`[Proxy] Response headers:`, JSON.stringify(proxyRes.headers, null, 2))
      }
      // Add CORS headers to response
      proxyRes.headers['access-control-allow-origin'] = '*'
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK'
      proxyRes.headers['access-control-allow-headers'] = '*'
      proxyRes.headers['access-control-allow-credentials'] = 'true'
      proxyRes.headers['access-control-expose-headers'] = 'ETag, etag, OC-ETag, Content-Type, Content-Length'
    },
    onError: (err, req, res) => {
      console.error('[Proxy] Error:', err.message)
      if (!res.headersSent) {
        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          res.status(504).json({ error: 'Gateway timeout: The request took too long. Try again.' })
        } else {
          res.status(500).json({ error: 'Proxy error: ' + err.message })
        }
      }
    }
  })

  proxy(req, res, next)
})

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy Server running on http://localhost:${PORT}`)
  if (NEXTCLOUD_URL) {
    console.log(`   Proxying to: ${NEXTCLOUD_URL}`)
    console.log(`   Use this URL in your WebDAV settings: http://localhost:${PORT}`)
  } else {
    console.log(`   ⚠️  NEXTCLOUD_URL not set. Set it as an environment variable:`)
    console.log(`      NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:proxy`)
    console.log(`   Or use query parameter: http://localhost:${PORT}?target=YOUR_NEXTCLOUD_URL`)
  }
})
