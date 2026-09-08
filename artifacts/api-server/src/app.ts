import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import passport from "./lib/passport";

const PgStore = ConnectPgSimple(session);

const app: Express = express();

// Trust the Replit reverse proxy so express-session issues secure cookies correctly
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Restrict CORS to known Replit preview/production origins only
const allowedOrigins = (() => {
  const origins: string[] = [];
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    domains.split(",").forEach((d) => origins.push(`https://${d.trim()}`));
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) origins.push(`https://${devDomain}`);
  // Always allow localhost in dev
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:22333", "http://localhost:5173");
  }
  return origins;
})();

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server requests (no origin) and known origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware backed by PostgreSQL
app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "auth_sessions",
      createTableIfMissing: true,
      // Prune expired sessions about once per hour; the store randomizes the
      // exact delay by default to avoid synchronized cleanup across instances.
      pruneSessionInterval: 60 * 60,
    }),
    secret: process.env.SESSION_SECRET ?? "croas-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api", router);

export default app;
