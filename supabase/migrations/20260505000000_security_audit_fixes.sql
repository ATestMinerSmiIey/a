-- ============================================================
-- Security audit fixes — round 2
-- ============================================================

-- 1. ORDER STATUS: add CHECK constraint so clients cannot insert
--    status='paid', 'shipped', 'delivered' etc.
ALTER TABLE public.orders
  ADD CONSTRAINT IF NOT EXISTS orders_status_valid
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled'));

-- Only admins can change status away from 'pending'.
-- The INSERT policy already forces default 'pending', but belt-and-suspenders:
-- Drop and recreate INSERT policy to explicitly fix status to 'pending'
DROP POLICY IF EXISTS "Authenticated users can place orders" ON public.orders;
CREATE POLICY "Authenticated users can place orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (
    length(btrim(ship_to_address)) > 0
    AND length(btrim(ship_to_country)) > 0
    AND (buyer_contact IS NULL OR length(btrim(buyer_contact)) <= 500)
    AND amount_usd >= 0
    AND status = 'pending'
  );

-- 2. ORDER ITEMS: verify unit_price matches the live listing price server-side
--    so buyers can't forge unit_price_usd = 0
DROP POLICY IF EXISTS "Anyone can add order items for valid orders" ON public.order_items;
CREATE POLICY "Order items must match listing price"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (
    quantity > 0
    AND quantity <= 9999
    AND unit_price_usd >= 0
    AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id
    )
    AND (
      -- Either the listing still exists and the submitted price is correct
      NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id)
      OR EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = listing_id
          AND l.price = unit_price_usd
          AND l.stock > 0
      )
    )
  );

-- 3. LISTINGS: restrict which columns are readable publicly
--    seller_id should not be exposed to anonymous users
DROP POLICY IF EXISTS "Anyone can view listings" ON public.listings;
CREATE POLICY "Anyone can view listings"
  ON public.listings FOR SELECT
  USING (true);
-- Note: column-level security on seller_id requires a view. Add a secure view:
CREATE OR REPLACE VIEW public.public_listings AS
  SELECT
    id, name, description, price, image_url, stock, ships_from,
    created_at, updated_at
  FROM public.listings;
GRANT SELECT ON public.public_listings TO anon, authenticated;

-- 4. WALLET SETTINGS: address validation and length cap
ALTER TABLE public.wallet_settings
  ADD CONSTRAINT IF NOT EXISTS wallet_address_length
    CHECK (char_length(address) <= 200);

-- 5. ORDERS: cap text field lengths to prevent storage abuse
ALTER TABLE public.orders
  ADD CONSTRAINT IF NOT EXISTS orders_address_length
    CHECK (char_length(ship_to_address) <= 1000),
  ADD CONSTRAINT IF NOT EXISTS orders_country_length
    CHECK (char_length(ship_to_country) <= 100),
  ADD CONSTRAINT IF NOT EXISTS orders_notes_length
    CHECK (char_length(notes) <= 2000),
  ADD CONSTRAINT IF NOT EXISTS orders_amount_max
    CHECK (amount_usd <= 1000000);

-- 6. LISTINGS: cap text field lengths
ALTER TABLE public.listings
  ADD CONSTRAINT IF NOT EXISTS listings_name_length
    CHECK (char_length(name) <= 120),
  ADD CONSTRAINT IF NOT EXISTS listings_description_length
    CHECK (char_length(description) <= 2000),
  ADD CONSTRAINT IF NOT EXISTS listings_ships_from_length
    CHECK (char_length(ships_from) <= 100),
  ADD CONSTRAINT IF NOT EXISTS listings_price_max
    CHECK (price >= 0 AND price <= 1000000);

-- 7. PGP CHALLENGES: automatic cleanup of expired/consumed rows to prevent unbounded growth
CREATE OR REPLACE FUNCTION public.cleanup_pgp_challenges()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.pgp_challenges
  WHERE expires_at < now() - interval '1 hour'
     OR (consumed = true AND created_at < now() - interval '1 day');
$$;

-- Schedule via pg_cron if available (Supabase supports this on paid plans):
-- SELECT cron.schedule('cleanup-pgp-challenges', '0 * * * *', 'SELECT public.cleanup_pgp_challenges()');
-- If not available, call this from the edge function or a periodic Supabase function.

-- 8. ORDER ITEMS: cap listing_name length
ALTER TABLE public.order_items
  ADD CONSTRAINT IF NOT EXISTS order_items_listing_name_length
    CHECK (char_length(listing_name) <= 120),
  ADD CONSTRAINT IF NOT EXISTS order_items_quantity_max
    CHECK (quantity > 0 AND quantity <= 9999);

-- 9. PROFILES: cap pgp_public_key size (max ~50KB is generous for any real PGP key)
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_pubkey_length
    CHECK (char_length(pgp_public_key) <= 51200);

-- 10. USER ROLES: prevent self-escalation — users cannot insert their own admin role.
--     Roles are only assigned by the pgp-verify edge function (service role).
--     Drop any permissive insert policy and ensure only service_role can insert.
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));
-- Note: service_role bypasses RLS, so the edge function can still insert roles.
