import { Router, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/user";
import { Session } from "../entity/session";
import { Machine } from "../entity/machine";
import { authMiddleware } from "../middleware/auth-middleware";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);
const sessionRepo = () => AppDataSource.getRepository(Session);
const machineRepo = () => AppDataSource.getRepository(Machine);

function createToken(user: User): string {
  const secret = process.env.JWT_SECRET || "mulapps-jwt-secret-2026-change-in-production";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ id: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() }, secret, { expiresIn } as jwt.SignOptions);
}

async function createSession(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const session = sessionRepo().create({ user_id: userId, token, expires_at: expiresAt });
  await sessionRepo().save(session);
}

function safeUser(user: User) {
  const { password: _pw, ...rest } = user;
  return rest;
}

// POST /register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = await userRepo().findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = userRepo().create({ email, password: hashed, name });
  await userRepo().save(user);

  const token = createToken(user);
  await createSession(user.id, token);

  res.status(201).json({ token, user: safeUser(user) });
});

// POST /login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = await userRepo().findOne({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = createToken(user);
  await createSession(user.id, token);

  res.json({ token, user: safeUser(user) });
});

// POST /logout
router.post("/logout", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];
  if (token) {
    const session = await sessionRepo().findOne({ where: { token } });
    if (session) await sessionRepo().remove(session);
  }
  res.json({ message: "Logged out successfully" });
});

// GET /me
router.get("/me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = await userRepo().findOne({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const machine = await machineRepo().findOne({ where: { assigned_user_id: user.id } });
  res.json({ user: safeUser(user), machine: machine || null });
});

export default router;
