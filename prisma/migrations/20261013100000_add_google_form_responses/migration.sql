CREATE TABLE IF NOT EXISTS crm_google_form_responses (
  id SERIAL PRIMARY KEY,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, response_id)
);

CREATE INDEX IF NOT EXISTS crm_google_form_responses_submitted_at_idx
  ON crm_google_form_responses (submitted_at DESC);
