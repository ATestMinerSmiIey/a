UPDATE storage.buckets
SET public = false
WHERE id = 'listing-images';

CREATE POLICY "PGP challenges are backend only"
ON public.pgp_challenges
FOR ALL
USING (false)
WITH CHECK (false);