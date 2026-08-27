import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupGoogleAuth, requireAuth, currentUserId } from "./googleAuth";
import geminiRoutes from "./geminiRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Google sign-in + a SQLite-backed session. Replit's OIDC only works inside Replit,
  // so it can't be the login path for a locally run or self-hosted app.
  setupGoogleAuth(app);
  
  app.use('/api/gemini', geminiRoutes);

  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = currentUserId(req)!;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = currentUserId(req)!;
      const { firstName, lastName, allergies, dietaryPreferences } = req.body;
      const user = await storage.updateUser(userId, {
        firstName,
        lastName,
        allergies,
        dietaryPreferences,
      });
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = currentUserId(req)!;
      await storage.deleteUser(userId);
      // req.logout() came from passport; the session is ours to end now
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Account deleted" });
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
