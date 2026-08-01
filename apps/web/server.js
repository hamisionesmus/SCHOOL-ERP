// Entry point for cPanel's "Setup Node.js App" (Passenger). Passenger runs this file directly with
// `node server.js` and expects it to listen on the port it assigns via process.env.PORT — the
// Next.js CLI (`next start`) isn't a plain JS file Passenger can point at, so this thin wrapper
// stands in for it. Not used in local dev (`npm run dev` / `npm run start` still work as before).
const { createServer } = require('node:http');
const next = require('next');

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Web app listening on port ${port}`);
  });
});
