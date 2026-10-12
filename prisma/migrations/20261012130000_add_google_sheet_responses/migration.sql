CREATE TABLE IF NOT EXISTS crm_google_sheet_responses (
  id SERIAL PRIMARY KEY,
  sheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  response JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sheet_id, sheet_name, row_number)
);

CREATE INDEX IF NOT EXISTS crm_google_sheet_responses_created_at_idx
  ON crm_google_sheet_responses (created_at DESC);
