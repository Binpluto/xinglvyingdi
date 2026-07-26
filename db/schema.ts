import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  inviteCode: text("invite_code").notNull(),
  invitedBy: text("invited_by"),
  xp: integer("xp").notNull().default(680),
  coins: integer("coins").notNull().default(286),
  focusMinutes: integer("focus_minutes").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_invite_code_idx").on(table.inviteCode)]);

export const quests = sqliteTable("quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  type: text("type").notNull(),
  reward: integer("reward").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const focusSessions = sqliteTable("focus_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  minutes: integer("minutes").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  ownerEmail: text("owner_email").notNull().references(() => users.email),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("teams_code_idx").on(table.code)]);

export const teamMembers = sqliteTable("team_members", {
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.teamId, table.userEmail] }),
  uniqueIndex("team_members_user_idx").on(table.userEmail),
]);

export const referrals = sqliteTable("referrals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referrerEmail: text("referrer_email").notNull().references(() => users.email),
  inviteeEmail: text("invitee_email").notNull().references(() => users.email),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("referrals_invitee_idx").on(table.inviteeEmail)]);
