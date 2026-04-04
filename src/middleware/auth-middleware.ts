import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { Session } from "../entity/session";

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "mulapps-jwt-secret-2026-change-in-production";

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const sessionRepo = AppDataSource.getRepository(Session);
  const session = await sessionRepo.findOne({ where: { token } });

  if (!session) {
    res.status(401).json({ error: "Session not found" });
    return;
  }

  if (new Date() > session.expires_at) {
    await sessionRepo.remove(session);
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.user = { id: payload.id, email: payload.email, role: payload.role };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
