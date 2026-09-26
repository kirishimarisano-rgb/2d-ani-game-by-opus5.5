// 迷你靜態伺服器（行為接近 GitHub Pages：資料夾自動補斜線並回傳 index.html）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

export function serve(root, port = 0) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      let st = fs.statSync(file);
      if (st.isDirectory()) {
        if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
        file = path.join(file, 'index.html');
        st = fs.statSync(file);
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => {
    const { port: p } = server.address();
    resolve({ url: `http://127.0.0.1:${p}/`, close: () => new Promise(r => server.close(r)) });
  }));
}
