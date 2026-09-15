const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = new Map([
  ["/", ["index.html", "text/html"]],
  ["/index.html", ["index.html", "text/html"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/domain.js", ["domain.js", "text/javascript"]],
  ["/styles.css", ["styles.css", "text/css"]],
  ["/assets/workbench.png", ["assets/workbench.png", "image/png"]],
  ["/vendor/supabase.js", ["vendor/supabase.js", "text/javascript"]],
  ["/vendor/lucide.js", ["vendor/lucide.js", "text/javascript"]],
]);
const server = http.createServer((request, response) => {
  const asset = files.get(new URL(request.url, "http://localhost").pathname);
  if (!asset || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "Content-Type": asset[1] + "; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(path.join(root, asset[0])).pipe(response);
});
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") server.listen(0, "127.0.0.1");
  else { console.error(error.message); process.exitCode = 1; }
});
server.on("listening", () => console.log("Weekender preview: http://127.0.0.1:" + server.address().port));
server.listen(Number(process.env.PORT) || 4173, "127.0.0.1");
