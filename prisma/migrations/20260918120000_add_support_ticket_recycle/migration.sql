ALTER TABLE crm_support_tickets ADD COLUMN IF NOT EXISTS recycled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS crm_support_tickets_recycled_at_idx ON crm_support_tickets(recycled_at);
