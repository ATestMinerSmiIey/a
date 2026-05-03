INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Listing images are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "Admins can upload listing images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update listing images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'listing-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'listing-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete listing images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'listing-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));