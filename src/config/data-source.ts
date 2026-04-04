import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entity/user";
import { Machine } from "../entity/machine";
import { Session } from "../entity/session";

const dbUrl = process.env.DATABASE_URL || "postgresql://admin:admin123@localhost:5432/hub";
const url = new URL(dbUrl);

export const AppDataSource = new DataSource({
  type: "postgres",
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  synchronize: true,
  logging: false,
  entities: [User, Machine, Session],
});
