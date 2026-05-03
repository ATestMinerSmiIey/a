ALTER TABLE public.listings DROP COLUMN IF EXISTS category;
DELETE FROM public.wallet_settings WHERE coin <> 'xmr';