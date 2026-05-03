DROP POLICY IF EXISTS "Admins can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update listing images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete listing images" ON storage.objects;

CREATE POLICY "Admins can upload listing images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update listing images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'listing-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete listing images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND app_private.has_role(auth.uid(), 'admin'::public.app_role));