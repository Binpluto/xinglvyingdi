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
  avatarKey: text("avatar_key").notNull().default("initial"),
  customAvatar: text("custom_avatar"),
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

export const dailySystemQuestDays = sqliteTable("daily_system_quest_days", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  questDate: text("quest_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.questDate] }),
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
  completedDate: text("completed_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("focus_sessions_daily_idx").on(table.userEmail, table.completedDate)]);

export const dailyDepartures = sqliteTable("daily_departures", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  departureDate: text("departure_date").notNull(),
  mainGoal: text("main_goal").notNull(),
  focusGoalMinutes: integer("focus_goal_minutes").notNull().default(25),
  energyLevel: text("energy_level").notNull().default("medium"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.departureDate] }),
  index("daily_departures_activity_idx").on(table.userEmail, table.departureDate),
]);

export const habitSettings = sqliteTable("habit_settings", {
  userEmail: text("user_email").primaryKey().references(() => users.email, { onDelete: "cascade" }),
  departureReminder: text("departure_reminder").default("08:30"),
  mainReminder: text("main_reminder").default("17:30"),
  reviewReminder: text("review_reminder").default("21:30"),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const habitRestDays = sqliteTable("habit_rest_days", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  restDate: text("rest_date").notNull(),
  monthKey: text("month_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.restDate] }),
  index("habit_rest_days_month_idx").on(table.userEmail, table.monthKey),
]);

export const habitRewards = sqliteTable("habit_rewards", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  milestone: integer("milestone").notNull(),
  claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.userEmail, table.milestone] })]);

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

export const teamInvitations = sqliteTable("team_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  inviterEmail: text("inviter_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  inviteeEmail: text("invitee_email").notNull(),
  status: text("status").notNull().default("pending"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("team_invitations_team_email_idx").on(table.teamId, table.inviteeEmail),
  index("team_invitations_invitee_status_idx").on(table.inviteeEmail, table.status),
]);

export const friendInvitations = sqliteTable("friend_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inviterEmail: text("inviter_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  inviteeEmail: text("invitee_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("friend_invitations_pair_idx").on(table.inviterEmail, table.inviteeEmail),
  index("friend_invitations_invitee_status_idx").on(table.inviteeEmail, table.status),
]);

export const teamJoinRequests = sqliteTable("team_join_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  applicantEmail: text("applicant_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("team_join_requests_team_applicant_idx").on(table.teamId, table.applicantEmail),
  index("team_join_requests_applicant_status_idx").on(table.applicantEmail, table.status),
  index("team_join_requests_team_status_idx").on(table.teamId, table.status),
]);

export const teamJoinRequestVotes = sqliteTable("team_join_request_votes", {
  requestId: integer("request_id").notNull().references(() => teamJoinRequests.id, { onDelete: "cascade" }),
  voterEmail: text("voter_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.requestId, table.voterEmail] })]);

export const siteNotifications = sqliteTable("site_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityId: integer("entity_id"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("site_notifications_user_read_idx").on(table.userEmail, table.readAt, table.createdAt)]);

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

export const premiumFreeSlots = sqliteTable("premium_free_slots", {
  slotNumber: integer("slot_number").primaryKey(),
  userEmail: text("user_email"),
  assignedAt: text("assigned_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("premium_free_slots_email_idx").on(table.userEmail)]);
