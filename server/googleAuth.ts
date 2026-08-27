import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage";
import { SqliteSessionStore } from "./sqliteSessionStore";

/**
 * "Sign in with Google" using Google Identity Services.
 *
 * The browser gets an ID token (a signed JWT) from Google and posts it here; we verify
 * it, upsert the user, and put their id in the session. No client secret is involved,
 * so nothing sensitive ships to the browser and nothing sensitive sits in .env beyond
 * the session secret.
 *
 * Verification uses Google's tokeninfo endpoint. That's an officially supported check
 * and keeps this dependency-free; a high-traffic deployment would instead verify the
 * JWT signature locally against Google's JWKS (via google-auth-library) to avoid a
 * network round-trip per sign-in.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export const googleClientId = (): string => process.env.GOOGLE_CLIENT_ID?.trim() ?? "";

export const googleConfigured = (): boolean => googleClientId().length > 0;

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  iss: string;
  exp: string;
  email?: string;
  email_verified?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

const verifyGoogleToken = async (credential: string): Promise<GoogleTokenInfo | null> => {
  const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) return null;
  const info = (await response.json()) as GoogleTokenInfo;

  // The token is signed by Google, but we still have to check it was issued FOR US and
  // is still valid — otherwise a token minted for any other app would be accepted.
  if (info.aud !== googleClientId()) return null;
  if (!VALID_ISSUERS.includes(info.iss)) return null;
  if (Number(info.exp) * 1000 <= Date.now()) return null;
  if (info.email && info.email_verified === "false") return null;

  return info;
};

export function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      store: new SqliteSessionStore(SESSION_TTL_MS),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // localhost is served over http; a real deployment must be https
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_TTL_MS,
      },
    })
  );

  // Lets the client know whether to render the Google button at all.
  app.get("/api/auth/config", (_req, res) => {
    res.json({ googleClientId: googleClientId(), googleEnabled: googleConfigured() });
  });

  app.post("/api/auth/google", async (req, res) => {
    if (!googleConfigured()) {
      return res.status(503).json({ message: "Google sign-in is not configured on this server." });
    }

    const { credential } = req.body ?? {};
    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({ message: "Missing Google credential." });
    }

    try {
      const info = await verifyGoogleToken(credential);
      if (!info) {
        return res.status(401).json({ message: "Google sign-in could not be verified." });
      }

      const user = await storage.upsertUser({
        id: info.sub,
        email: info.email ?? null,
        firstName: info.given_name ?? info.name?.split(" ")[0] ?? null,
        lastName: info.family_name ?? null,
        profileImageUrl: info.picture ?? null,
      });

      // Guard against session fixation: new privilege level, new session id.
      req.session.regenerate(err => {
        if (err) {
          console.error("Session regenerate failed:", err);
          return res.status(500).json({ message: "Could not start a session." });
        }
        req.session.userId = info.sub;
        req.session.save(saveErr => {
          if (saveErr) {
            console.error("Session save failed:", saveErr);
            return res.status(500).json({ message: "Could not start a session." });
          }
          res.json(user);
        });
      });
    } catch (error: any) {
      console.error("Google sign-in error:", error?.message || error);
      res.status(500).json({ message: "Google sign-in failed." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
}

/** The signed-in user's id, or null. SKIP_AUTH keeps the local dev bypass working. */
export const currentUserId = (req: any): string | null => {
  if (process.env.SKIP_AUTH === "true") return "dev-user";
  return req.session?.userId ?? null;
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (currentUserId(req)) return next();
  res.status(401).json({ message: "Unauthorized" });
};
