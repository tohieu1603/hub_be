import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, JoinColumn, OneToOne } from "typeorm";
import { User } from "./user";

@Entity("machines")
export class Machine {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string; // "Mac Mini #1"

  @Column({ nullable: true })
  subdomain!: string; // "mac1"

  @Column()
  hub_url!: string; // "http://localhost:3000"

  @Column({ default: "available" })
  status!: string; // available | assigned | offline | maintenance

  @Column({ type: "jsonb", nullable: true })
  specs!: Record<string, unknown> | null;

  @Column({ nullable: true })
  assigned_user_id!: string | null;

  @OneToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: "assigned_user_id" })
  assigned_user!: User | null;

  @Column({ type: "timestamp", nullable: true })
  assigned_at!: Date | null;

  // Unique API key for Hub ↔ Backend authentication
  @Column({ type: "varchar", unique: true, nullable: true })
  api_key!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
