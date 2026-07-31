import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const authAccounts = sqliteTable("auth_accounts", {
  email: text("email").primaryKey().references(() => users.email, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("auth_sessions_user_idx").on(table.userEmail),
  index("auth_sessions_expiry_idx").on(table.expiresAt),
]);

export const quests = sqliteTable("quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  type: text("type").notNull(),
  reward: integer("reward").notNull(),
  source: text("source").notNull().default("manual"),
  dueAt: text("due_at"),
  externalId: text("external_id"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("quests_calendar_event_idx").on(table.userEmail, table.source, table.externalId),
]);

export const questCompletions = sqliteTable("quest_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  questId: integer("quest_id"),
  questTitle: text("quest_title").notNull(),
  reward: integer("reward").notNull(),
  source: text("source").notNull().default("manual"),
  completedDate: text("completed_date").notNull(),
  completedAt: text("completed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("quest_completions_quest_idx").on(table.userEmail, table.questId),
  index("quest_completions_activity_idx").on(table.userEmail, table.completedDate),
]);

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

export const inventory = sqliteTable("inventory", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  itemKey: text("item_key").notNull(),
  quantity: integer("quantity").notNull().default(1),
  acquiredAt: text("acquired_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.userEmail, table.itemKey] })]);

export const realmProgress = sqliteTable("realm_progress", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  realmId: text("realm_id").notNull(),
  completedRegions: integer("completed_regions").notNull().default(0),
  unlocked: integer("unlocked", { mode: "boolean" }).notNull().default(false),
  target: integer("target", { mode: "boolean" }).notNull().default(false),
  unlockedAt: text("unlocked_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.realmId] }),
  index("realm_progress_user_idx").on(table.userEmail),
]);

export const googleCalendarConnections = sqliteTable("google_calendar_connections", {
  userEmail: text("user_email").primaryKey().references(() => users.email, { onDelete: "cascade" }),
  refreshToken: text("refresh_token").notNull(),
  googleEmail: text("google_email"),
  syncToken: text("sync_token"),
  lastSyncedAt: text("last_synced_at"),
  connectedAt: text("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleOauthStates = sqliteTable("google_oauth_states", {
  state: text("state").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("google_oauth_states_expiry_idx").on(table.expiresAt)]);

export const calendarEntitlements = sqliteTable("calendar_entitlements", {
  userEmail: text("user_email").primaryKey().references(() => users.email, { onDelete: "cascade" }),
  trialStartedAt: text("trial_started_at"),
  accessUntil: text("access_until"),
  source: text("source"),
  levelRewardClaimedAt: text("level_reward_claimed_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("calendar_entitlements_expiry_idx").on(table.accessUntil)]);

export const calendarPayments = sqliteTable("calendar_payments", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  amountCnyFen: integer("amount_cny_fen").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("calendar_payments_user_idx").on(table.userEmail)]);

export const calendarCheckoutOrders = sqliteTable("calendar_checkout_orders", {
  externalId: text("external_id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  expectedCurrency: text("expected_currency").notNull(),
  expectedAmountMinor: integer("expected_amount_minor").notNull(),
  providerSessionId: text("provider_session_id"),
  providerEventId: text("provider_event_id"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("calendar_checkout_orders_user_idx").on(table.userEmail),
  uniqueIndex("calendar_checkout_orders_event_idx").on(table.providerEventId),
]);
