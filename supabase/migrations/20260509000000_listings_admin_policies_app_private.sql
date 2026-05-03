-- Ensure listing write RLS uses app_private.has_role only.
-- If policies still referenced public.has_role after it was revoked from authenticated, saves fail even for admins.

DROP POLICY IF EXISTS "Admins can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can delete listings" ON public.listings;

CREATE POLICY "Admins can insert listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update listings"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete listings"
  ON public.listings
  FOR DELETE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));
