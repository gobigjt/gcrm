CREATE TABLE IF NOT EXISTS notification_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_push_tokens_user_active
  ON notification_push_tokens (user_id, is_active);
