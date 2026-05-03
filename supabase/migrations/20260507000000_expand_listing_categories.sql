-- Add THC edibles + codeine syrup; keep existing categories valid
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
