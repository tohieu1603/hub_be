import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Machine } from "../entity/machine";

const router = Router();

async function proxyToHub(req: Request, res: Response, hubPath: string, method: string = "GET"): Promise<Response> {
  const userId = req.user!.id;
  const machineRepo = AppDataSource.getRepository(Machine);
  const machine = await machineRepo.findOne({ where: { assigned_user_id: userId } });
  if (!machine) return res.status(404).json({ error: "No machine assigned to your account" });
  if (machine.status === "offline") return res.status(503).json({ error: "Your machine is offline" });

  try {
    const url = `${machine.hub_url}${hubPath}`;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        // Identity headers — Hub knows who's calling
        "X-User-Id": userId,
        "X-User-Email": req.user!.email,
        "X-User-Name": req.user!.name,
        "X-Machine-Id": machine.id,
        "X-Machine-Name": machine.name,
        "X-Api-Key": process.env.HUB_API_KEY || process.env.HUB_KEY || "",
      },
    };
    if (method === "POST" || method === "PUT") {
      fetchOptions.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch {
      return res.status(response.status).json({ error: text.slice(0, 200) });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(502).json({ error: `Hub unreachable: ${message}` });
  }
}

router.get("/status", (req, res) => proxyToHub(req, res, "/"));
router.get("/apps", (req, res) => proxyToHub(req, res, "/api/apps"));
router.get("/capabilities", (req, res) => proxyToHub(req, res, "/api/capabilities"));
router.get("/dashboard", (req, res) => proxyToHub(req, res, "/api/dashboard"));
router.get("/activity", (req, res) => proxyToHub(req, res, "/api/activity"));
router.post("/execute", (req, res) => proxyToHub(req, res, "/api/execute", "POST"));
router.post("/chat", (req, res) => proxyToHub(req, res, "/api/chat", "POST"));

export default router;
