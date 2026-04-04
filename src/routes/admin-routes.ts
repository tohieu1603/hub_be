import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/user";
import { Machine } from "../entity/machine";

const router = Router();

// GET /users — list all users
router.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const userRepo = AppDataSource.getRepository(User);
  const machineRepo = AppDataSource.getRepository(Machine);

  const users = await userRepo.find({ order: { created_at: "DESC" } });
  const machines = await machineRepo.find();

  const result = users.map((u) => {
    const machine = machines.find((m) => m.assigned_user_id === u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      created_at: u.created_at,
      machine: machine ? { id: machine.id, name: machine.name, status: machine.status, hub_url: machine.hub_url } : null,
    };
  });

  res.json(result);
});

// PUT /users/:id/role — change user role
router.put("/users/:id/role", async (req: Request, res: Response): Promise<void> => {
  const userRepo = AppDataSource.getRepository(User);
  const { role } = req.body;
  if (!role || !["admin", "user"].includes(role)) {
    res.status(400).json({ error: "role must be 'admin' or 'user'" });
    return;
  }

  const user = await userRepo.findOne({ where: { id: req.params.id } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  user.role = role;
  await userRepo.save(user);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// DELETE /users/:id — delete user (unassign machine first)
router.delete("/users/:id", async (req: Request, res: Response): Promise<void> => {
  const userRepo = AppDataSource.getRepository(User);
  const machineRepo = AppDataSource.getRepository(Machine);

  const user = await userRepo.findOne({ where: { id: req.params.id } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Unassign machine if any
  const machine = await machineRepo.findOne({ where: { assigned_user_id: user.id } });
  if (machine) {
    machine.assigned_user_id = null;
    machine.status = "available";
    machine.assigned_at = null;
    await machineRepo.save(machine);
  }

  await userRepo.remove(user);
  res.json({ deleted: true });
});

export default router;
