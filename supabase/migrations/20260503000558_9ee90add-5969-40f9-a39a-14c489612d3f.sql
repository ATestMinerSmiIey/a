
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
CREATE POLICY "Anyone can place an order"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (
    length(btrim(ship_to_name)) > 0
    AND length(btrim(ship_to_address)) > 0
    AND length(btrim(ship_to_country)) > 0
    AND length(btrim(buyer_contact)) > 0
    AND quantity > 0
  );
