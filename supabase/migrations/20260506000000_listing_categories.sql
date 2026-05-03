-- Restore listing categories (THC pens, codeine, general)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_category_valid;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_category_valid
  CHECK (category IN ('general', 'thc_pens', 'codeine'));

CREATE OR REPLACE VIEW public.public_listings AS
  SELECT
    id, name, description, price, image_url, stock, ships_from, category,
    created_at, updated_at
  FROM public.listings;
