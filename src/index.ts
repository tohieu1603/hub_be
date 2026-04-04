import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
// import rateLimit from "express-rate-limit";
import { AppDataSource } from "./config/data-source";
import authRoutes from "./routes/auth-routes";
import machineRoutes from "./routes/machine-routes";
import adminRoutes from "./routes/admin-routes";
import hubProxyRoutes from "./routes/hub-proxy-routes";
import { authMiddleware, requireAdmin } from "./middleware/auth-middleware";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
console.log("[ENV] HUB_API_KEY:", process.env.HUB_API_KEY ? "set (" + process.env.HUB_API_KEY.slice(0, 8) + "...)" : "NOT SET");

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Rate limits (disabled for now)
// const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
// const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
// const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/machines", authMiddleware, requireAdmin, machineRoutes);
app.use("/api/admin", authMiddleware, requireAdmin, adminRoutes);
app.use("/api/hub", authMiddleware, hubProxyRoutes);

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
