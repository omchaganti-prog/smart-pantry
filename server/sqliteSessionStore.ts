import session from "express-session";
import { eq, lt } from "drizzle-orm";
import { db } from "./db";
import { sessions } from "../shared/schema";

/**
 * express-session store backed by the existing `sessions` table.
 *
 * The project moved from Postgres to SQLite but kept `connect-pg-simple`, which only
 * speaks Postgres — so real logins had nowhere to persist and the table went unused.
 * An in-memory store would work but would sign everyone out on every server restart.
 */
export class SqliteSessionStore extends session.Store {
  constructor(private readonly ttlMs: number) {
    super();
    // clear out expired rows hourly; unref so this never holds the process open
    const timer = setInterval(() => this.reap(), 60 * 60 * 1000);
    timer.unref?.();
  }

  private reap() {
    try {
      db.delete(sessions).where(lt(sessions.expire, new Date())).run();
    } catch (err) {
      console.error("Session reap failed:", err);
    }
  }

  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    try {
      const [row] = db.select().from(sessions).where(eq(sessions.sid, sid)).all();
      if (!row) return callback(null, null);
      if (row.expire && row.expire.getTime() < Date.now()) {
        return this.destroy(sid, () => callback(null, null));
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expiresAt = sess.cookie?.expires
        ? new Date(sess.cookie.expires)
        : new Date(Date.now() + this.ttlMs);

      db.insert(sessions)
        .values({ sid, sess: JSON.stringify(sess), expire: expiresAt })
        .onConflictDoUpdate({
          target: sessions.sid,
          set: { sess: JSON.stringify(sess), expire: expiresAt },
        })
        .run();
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    try {
      db.delete(sessions).where(eq(sessions.sid, sid)).run();
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expiresAt = sess.cookie?.expires
        ? new Date(sess.cookie.expires)
        : new Date(Date.now() + this.ttlMs);
      db.update(sessions).set({ expire: expiresAt }).where(eq(sessions.sid, sid)).run();
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}
