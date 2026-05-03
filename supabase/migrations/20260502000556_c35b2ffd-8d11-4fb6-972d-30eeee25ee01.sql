CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO service_role;

DROP POLICY IF EXISTS "Admins can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can delete listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can insert wallet settings" ON public.wallet_settings;
DROP POLICY IF EXISTS "Admins can update wallet settings" ON public.wallet_settings;
DROP POLICY IF EXISTS "Admins can delete wallet settings" ON public.wallet_settings;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

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

CREATE POLICY "Admins can insert wallet settings"
ON public.wallet_settings
FOR INSERT
TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update wallet settings"
ON public.wallet_settings
FOR UPDATE
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete wallet settings"
ON public.wallet_settings
FOR DELETE
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;