
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS ships_from text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  listing_name text NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  ships_from text NOT NULL DEFAULT '',
  ship_to_name text NOT NULL,
  ship_to_address text NOT NULL,
  ship_to_country text NOT NULL,
  buyer_contact text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can place an order"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_wallet_settings_updated_at();
