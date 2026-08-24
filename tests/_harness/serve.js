import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

export function startServer(root) {
  const servedRoot = path.resolve(root)

  const server = http.createServer(async (request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const filePath = path.resolve(servedRoot, '.' + (urlPath === '/' ? '/index.html' : urlPath))

    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

    // `URL` only collapses `..` when the separator is a literal `/`; a
    // percent-encoded slash survives normalisation and `decodeURIComponent`
    // turns it back into one. Re-check the resolved path against the root.
    if (filePath !== servedRoot && !filePath.startsWith(servedRoot + path.sep)) {
      response.statusCode = 404
      response.end('not found')
      return
    }

    try {
      const body = await readFile(filePath)
      response.setHeader('Content-Type', CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream')
      response.end(body)
    } catch {
      response.statusCode = 404
      response.end('not found')
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}
