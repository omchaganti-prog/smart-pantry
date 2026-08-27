import { users, type User, type UpsertUser } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) {
      // Parse JSON strings back to arrays for SQLite
      return {
        ...user,
        allergies: user.allergies ? JSON.parse(user.allergies) : null,
        dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : null,
      } as User;
    }
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Convert arrays to JSON strings for SQLite
    const dataToInsert = {
      ...userData,
      allergies: userData.allergies ? JSON.stringify(userData.allergies) : null,
      dietaryPreferences: userData.dietaryPreferences ? JSON.stringify(userData.dietaryPreferences) : null,
    };
    
    const [user] = await db
      .insert(users)
      .values(dataToInsert as any)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...dataToInsert,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return {
      ...user,
      allergies: user.allergies ? JSON.parse(user.allergies) : null,
      dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : null,
    } as User;
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    // Convert arrays to JSON strings for SQLite
    const dataToUpdate = {
      ...data,
      allergies: data.allergies ? JSON.stringify(data.allergies) : undefined,
      dietaryPreferences: data.dietaryPreferences ? JSON.stringify(data.dietaryPreferences) : undefined,
      updatedAt: new Date(),
    };
    
    const [user] = await db
      .update(users)
      .set(dataToUpdate as any)
      .where(eq(users.id, id))
      .returning();
    
    if (user) {
      return {
        ...user,
        allergies: user.allergies ? JSON.parse(user.allergies) : null,
        dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : null,
      } as User;
    }
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
}

export const storage = new DatabaseStorage();
