BEGIN;
DO $$ BEGIN IF current_database()<>'starcamp_calendar_test' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
CREATE TABLE IF NOT EXISTS calendar_bridge_test.pilot_links (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  quest_id bigint,
  state text NOT NULL DEFAULT 'new' CHECK(state IN ('new','creating','linked','suppressed')),
  claim_id uuid,
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  title_override text,
  detail_override text,
  PRIMARY KEY(user_id,event_id),
  UNIQUE(user_id,quest_id),
  FOREIGN KEY(user_id,event_id) REFERENCES calendar_bridge_test.events(user_id,id) ON DELETE RESTRICT
);
REVOKE ALL ON calendar_bridge_test.pilot_links FROM PUBLIC;
INSERT INTO calendar_bridge_test.migrations(version) VALUES('002_owner_pilot') ON CONFLICT DO NOTHING;
COMMIT;
