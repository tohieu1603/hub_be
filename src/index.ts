import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import rateLimit from "express-rate-limit";
import { AppDataSource } from "./config/data-source";
import authRoutes from "./routes/auth-routes";
import machineRoutes from "./routes/machine-routes";
import hubProxyRoutes from "./routes/hub-proxy-routes";
import { authMiddleware, requireAdmin } from "./middleware/auth-middleware";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
console.log("[ENV] HUB_API_KEY:", process.env.HUB_API_KEY ? "set (" + process.env.HUB_API_KEY.slice(0, 8) + "...)" : "NOT SET");

const app = express();
app.use(cors());
app.use(express.json());

// Rate limits
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many auth attempts" } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: "Chat rate limit: 5 requests/min" } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: "API rate limit exceeded" } });

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Public routes (with auth rate limit)
app.use("/api/auth", authLimiter, authRoutes);

// Protected routes
app.use("/api/machines", authMiddleware, apiLimiter, requireAdmin, machineRoutes);
app.use("/api/hub/chat", authMiddleware, chatLimiter); // Chat: 5/min (expensive)
app.use("/api/hub", authMiddleware, apiLimiter, hubProxyRoutes);

const PORT = process.env.PORT || 4000;

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });
