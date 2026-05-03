-- Package tracking (e.g. matched via 17TRACK for confirmed orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_carrier integer,
  ADD COLUMN IF NOT EXISTS tracking_synced_at timestamptz;

COMMENT ON COLUMN public.orders.tracking_number IS 'Carrier tracking number; 17TRACK and buyers use this for status.';
