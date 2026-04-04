import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Machine } from "../entity/machine";

const router = Router();

function getHubHeaders(req: Request, machine: Machine): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-User-Id": req.user!.id,
    "X-User-Email": req.user!.email,
    "X-User-Name": req.user!.name,
    "X-Machine-Id": machine.id,
    "X-Machine-Name": machine.name,
    "X-Api-Key": process.env.HUB_API_KEY || "",
  };
}

async function getMachine(userId: string): Promise<Machine | null> {
  const repo = AppDataSource.getRepository(Machine);
  return repo.findOne({ where: { assigned_user_id: userId } });
}

/** Standard JSON proxy */
async function proxyToHub(req: Request, res: Response, hubPath: string, method = "GET") {
  const machine = await getMachine(req.user!.id);
  if (!machine) return res.status(404).json({ error: "No machine assigned" });
  if (machine.status === "offline") return res.status(503).json({ error: "Machine offline" });

  try {
    const resp = await fetch(`${machine.hub_url}${hubPath}`, {
      method,
      headers: getHubHeaders(req, machine),
      body: method !== "GET" ? JSON.stringify(req.body) : undefined,
    });
    const text = await resp.text();
    try { return res.status(resp.status).json(JSON.parse(text)); }
    catch { return res.status(resp.status).json({ error: text.slice(0, 200) }); }
  } catch (err: unknown) {
    return res.status(502).json({ error: `Hub unreachable: ${(err as Error).message}` });
  }
}

/** SSE streaming proxy — pipe Hub SSE stream to client */
async function proxySSE(req: Request, res: Response, hubPath: string) {
  const machine = await getMachine(req.user!.id);
  if (!machine) return res.status(404).json({ error: "No machine assigned" });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  try {
    const resp = await fetch(`${machine.hub_url}${hubPath}`, {
      method: "POST",
      headers: getHubHeaders(req, machine),
      body: JSON.stringify(req.body),
    });

    if (!resp.ok || !resp.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: `Hub returned ${resp.status}` })}\n\n`);
      res.end();
      return;
    }

    // Pipe the readable stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    };

    pump().catch(() => res.end());

    // Client disconnect → abort
    req.on("close", () => {
      reader.cancel();
      res.end();
    });
  } catch (err: unknown) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    res.end();
  }
}

// JSON routes
router.get("/status", (req, res) => proxyToHub(req, res, "/"));
router.get("/apps", (req, res) => proxyToHub(req, res, "/api/apps"));
router.get("/capabilities", (req, res) => proxyToHub(req, res, "/api/capabilities"));
router.get("/dashboard", (req, res) => proxyToHub(req, res, "/api/dashboard"));
router.get("/activity", (req, res) => proxyToHub(req, res, "/api/activity"));
router.post("/execute", (req, res) => proxyToHub(req, res, "/api/execute", "POST"));

// Chat routes
router.post("/chat/stream", (req, res) => proxySSE(req, res, "/api/chat/stream"));
router.post("/chat", (req, res) => proxyToHub(req, res, "/api/chat", "POST"));

export default router;
