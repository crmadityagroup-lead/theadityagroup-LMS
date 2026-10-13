ALTER TABLE crm_google_form_responses
  ADD COLUMN IF NOT EXISTS respondent_email TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
