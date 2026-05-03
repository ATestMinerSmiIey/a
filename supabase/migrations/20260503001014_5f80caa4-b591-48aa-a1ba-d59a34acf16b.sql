
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Admins view orders" ON public.orders;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_listing_id_fkey,
  DROP COLUMN IF EXISTS listing_id,
  DROP COLUMN IF EXISTS listing_name,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS ships_from,
  DROP COLUMN IF EXISTS ship_to_name;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  listing_name text NOT NULL,
  ships_from text NOT NULL DEFAULT '',
  unit_price_usd numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can place an order"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (
    length(btrim(ship_to_address)) > 0
    AND length(btrim(ship_to_country)) > 0
    AND length(btrim(buyer_contact)) > 0
  );

CREATE POLICY "Anyone can view orders"
  ON public.orders FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can add order items"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (quantity > 0);

CREATE POLICY "Anyone can view order items"
  ON public.order_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins update order items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete order items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));
