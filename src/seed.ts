import "reflect-metadata";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./config/data-source";
import { User } from "./entity/user";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);
  const hash = bcrypt.hashSync("admin123", 10);

  const users = [
    { email: "admin@gmail.com", name: "Admin", role: "admin" },
    { email: "user@gmail.com", name: "User", role: "user" },
  ];

  for (const u of users) {
    const exists = await repo.findOne({ where: { email: u.email } });
    if (exists) {
      exists.role = u.role;
      exists.password = hash;
      await repo.save(exists);
      console.log(`Updated: ${u.email} (${u.role})`);
    } else {
      await repo.save(repo.create({ ...u, password: hash }));
      console.log(`Created: ${u.email} (${u.role})`);
    }
  }

  console.log("\nDone. Login with password: admin123");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
