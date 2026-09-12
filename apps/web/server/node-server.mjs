/**
 * Production Node entry for self-hosted (Docker) deployment.
 *
 * `vite build` emits a fetch handler, not a listening server:
 * dist/server/server.js -> export default { fetch(Request) }, plus a static
 * client build in dist/client.
 *
 * This wraps both into an http server, using the same srvx bridge that
 * TanStack Start's own preview server uses.
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeRequest, sendNodeResponse } from 'srvx/node'

const root = fileURLToPath(new URL('..', import.meta.url))
const clientDir = join(root, 'dist', 'client')
const serverEntry = join(root, 'dist', 'server', 'server.js')

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const { default: app } = await import(serverEntry)

/** Resolve a URL path to a file inside dist/client, or null. */
function resolveStatic(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  // normalize() collapses ".."; the prefix check then rejects escapes.
  const candidate = normalize(join(clientDir, decoded))
  if (!candidate.startsWith(clientDir)) return null
  if (!existsSync(candidate)) return null
  const stat = statSync(candidate)
  if (!stat.isFile()) return null
  return { path: candidate, size: stat.size }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = (req.url ?? '/').split('?')[0]

    if (req.method === 'GET' || req.method === 'HEAD') {
      const file = resolveStatic(pathname)
      if (file) {
        const ext = extname(file.path)
        // Vite emits content-hashed filenames under /assets — safe to pin.
        const immutable = pathname.startsWith('/assets/')
        res.writeHead(200, {
          'content-type': MIME[ext] ?? 'application/octet-stream',
          'content-length': String(file.size),
          'cache-control': immutable
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=0, must-revalidate',
        })
        if (req.method === 'HEAD') return res.end()
        return createReadStream(file.path).pipe(res)
      }
    }

    const webRes = await app.fetch(new NodeRequest({ req, res }))
    return sendNodeResponse(res, webRes)
  } catch (err) {
    console.error('[wopla-ai] request failed:', err)
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[wopla-ai] listening on http://${HOST}:${PORT}`)
})

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)))
}
