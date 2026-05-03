-- Run in Supabase → SQL Editor if listings.category is missing (PGRST204 / schema cache).
-- Prefer: supabase db push / link so all migrations apply. This snippet is idempotent.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_category_valid;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_category_valid
  CHECK (
    category IN (
      'general',
      'thc_edibles',
      'thc_pens',
      'codeine',
      'codeine_syrup'
    )
  );
