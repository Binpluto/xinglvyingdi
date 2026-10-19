-- Only apply to the isolated Neon database starcamp_calendar_test.
-- No production credentials, events or users are imported by this migration.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'starcamp_calendar_test' THEN
    RAISE EXCEPTION 'Wrong database: expected starcamp_calendar_test';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS calendar_bridge_test;
REVOKE ALL ON SCHEMA calendar_bridge_test FROM PUBLIC;
CREATE TABLE IF NOT EXISTS calendar_bridge_test.migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_subject text NOT NULL UNIQUE,
  email text NOT NULL,
  time_zone text NOT NULL DEFAULT 'Europe/Berlin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.oauth_states (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  verifier_ciphertext text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bridge_oauth_expiry_idx ON calendar_bridge_test.oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES calendar_bridge_test.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bridge_sessions_user_idx ON calendar_bridge_test.sessions(user_id);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES calendar_bridge_test.users(id) ON DELETE CASCADE,
  google_subject text NOT NULL,
  google_email text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','reconnect_required','disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_subject), UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  google_calendar_id text NOT NULL,
  summary text NOT NULL,
  time_zone text NOT NULL DEFAULT 'Europe/Berlin',
  access_role text NOT NULL,
  selected boolean NOT NULL DEFAULT false,
  sync_from_date date NOT NULL DEFAULT CURRENT_DATE,
  sync_token text,
  sync_query jsonb NOT NULL DEFAULT '{}',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  sync_lease_owner uuid,
  sync_lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,connection_id) REFERENCES calendar_bridge_test.connections(user_id,id) ON DELETE CASCADE,
  UNIQUE(connection_id,google_calendar_id), UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_id uuid NOT NULL,
  google_event_id text NOT NULL,
  recurring_event_id text,
  original_start jsonb,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  all_day boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz,
  source_etag text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','out_of_range')),
  last_seen_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,calendar_id) REFERENCES calendar_bridge_test.calendars(user_id,id) ON DELETE CASCADE,
  UNIQUE(calendar_id,google_event_id), UNIQUE(user_id,id),
  CHECK(status <> 'active' OR
    (all_day AND start_date IS NOT NULL AND end_date > start_date AND starts_at IS NULL AND ends_at IS NULL) OR
    (NOT all_day AND starts_at IS NOT NULL AND ends_at > starts_at AND start_date IS NULL AND end_date IS NULL))
);
CREATE INDEX IF NOT EXISTS bridge_events_user_time_idx ON calendar_bridge_test.events(user_id,starts_at);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.task_completions (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_local_date date NOT NULL,
  reward_status text NOT NULL DEFAULT 'disabled' CHECK(reward_status IN ('disabled','pending','confirmed','needs_review')),
  upstream_quest_id bigint,
  PRIMARY KEY(user_id,event_id),
  FOREIGN KEY(user_id,event_id) REFERENCES calendar_bridge_test.events(user_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS calendar_bridge_test.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('running','success','failed')),
  mode text NOT NULL CHECK(mode IN ('full','incremental','rebuild')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  added_count integer NOT NULL DEFAULT 0 CHECK(added_count>=0),
  updated_count integer NOT NULL DEFAULT 0 CHECK(updated_count>=0),
  archived_count integer NOT NULL DEFAULT 0 CHECK(archived_count>=0),
  unchanged_count integer NOT NULL DEFAULT 0 CHECK(unchanged_count>=0),
  error_code text,
  FOREIGN KEY(user_id,calendar_id) REFERENCES calendar_bridge_test.calendars(user_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bridge_sync_runs_recent_idx ON calendar_bridge_test.sync_runs(user_id,started_at DESC);
REVOKE ALL ON ALL TABLES IN SCHEMA calendar_bridge_test FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA calendar_bridge_test REVOKE ALL ON TABLES FROM PUBLIC;
INSERT INTO calendar_bridge_test.migrations(version) VALUES('001_calendar_bridge_test') ON CONFLICT(version) DO NOTHING;
COMMIT;
SELECT table_name FROM information_schema.tables
WHERE table_schema='calendar_bridge_test' ORDER BY table_name;
