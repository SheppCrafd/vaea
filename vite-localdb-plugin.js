import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROUTE_PREFIX = "/__localdb/";

// Dev/preview-only middleware backing src/lib/localDb.js with real JSON files
// in a gitignored `data/` folder inside the cloned repo, instead of the
// browser's localStorage — so a developer running the app locally can open
// their own data as plain files. Only wired up for `vite`/`vite preview`
// (configureServer/configurePreviewServer below); a production build, the
// base44-hosted preview, and the standalone distributions have no Node
// process behind them at all, so localDb.js falls back to localStorage
// there automatically (see its own capability check).
export default function localDbFilePlugin() {
  const dataDir = join(process.cwd(), "data");

  const collectionPath = (name) => join(dataDir, `${name}.json`);

  const readCollectionFile = (name) => {
    const path = collectionPath(name);
    if (!existsSync(path)) return [];
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return [];
    }
  };

  const writeCollectionFile = (name, items) => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(collectionPath(name), JSON.stringify(items, null, 2), "utf-8");
  };

  const handleRequest = (req, res) => {
    const name = req.url.slice(ROUTE_PREFIX.length).split("?")[0];
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      res.statusCode = 400;
      res.end("Invalid collection name");
      return true;
    }

    if (req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(readCollectionFile(name)));
      return true;
    }

    if (req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const items = JSON.parse(body);
          writeCollectionFile(name, items);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end("Invalid JSON body");
        }
      });
      return true;
    }

    res.statusCode = 405;
    res.end("Method not allowed");
    return true;
  };

  const middleware = (req, res, next) => {
    if (!req.url.startsWith(ROUTE_PREFIX)) return next();
    handleRequest(req, res);
  };

  return {
    name: "portfolio-tracker-localdb-files",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
