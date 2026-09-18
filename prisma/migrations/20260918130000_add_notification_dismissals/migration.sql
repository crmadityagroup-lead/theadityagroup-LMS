CREATE TABLE IF NOT EXISTS crm_notification_dismissals (
  user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);
