import { Router, Request, Response } from "express";
import crypto from "crypto";
import { AppDataSource } from "../config/data-source";
import { Machine } from "../entity/machine";

const router = Router();
const machineRepo = () => AppDataSource.getRepository(Machine);

// GET / - list all machines
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const machines = await machineRepo().find();
  res.json(machines);
});

// POST / - create machine
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { name, hub_url, subdomain, hub_api_key } = req.body;
  if (!name || !hub_url) {
    res.status(400).json({ error: "name and hub_url are required" });
    return;
  }

  // hub_api_key: admin nhập key từ Hub .env, mỗi Hub 1 key riêng
  const apiKey = hub_api_key || `mkey_${crypto.randomBytes(24).toString("hex")}`;
  const machine = machineRepo().create({ name, hub_url, subdomain: subdomain || null, api_key: apiKey });
  await machineRepo().save(machine);
  res.status(201).json(machine);
});

// PUT /:id/assign - assign machine to user
router.put("/:id/assign", async (req: Request, res: Response): Promise<void> => {
  const { user_id } = req.body;
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }

  const machine = await machineRepo().findOne({ where: { id: req.params.id } });
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }

  // Check if another machine is already assigned to this user
  const existing = await machineRepo().findOne({ where: { assigned_user_id: user_id } });
  if (existing && existing.id !== machine.id) {
    res.status(409).json({ error: "User already has a machine assigned", machine_id: existing.id });
    return;
  }

  machine.assigned_user_id = user_id;
  machine.status = "assigned";
  machine.assigned_at = new Date();
  await machineRepo().save(machine);

  res.json(machine);
});

// PUT /:id/unassign - unassign machine
router.put("/:id/unassign", async (req: Request, res: Response): Promise<void> => {
  const machine = await machineRepo().findOne({ where: { id: req.params.id } });
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }

  machine.assigned_user_id = null;
  machine.status = "available";
  machine.assigned_at = null;
  await machineRepo().save(machine);

  res.json(machine);
});

export default router;
