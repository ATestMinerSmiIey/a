
CREATE TABLE public.wallet_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coin text NOT NULL UNIQUE,
  address text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wallet settings"
ON public.wallet_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can insert wallet settings"
ON public.wallet_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update wallet settings"
ON public.wallet_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete wallet settings"
ON public.wallet_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_wallet_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_wallet_settings_updated_at
BEFORE UPDATE ON public.wallet_settings
FOR EACH ROW EXECUTE FUNCTION public.update_wallet_settings_updated_at();

INSERT INTO public.wallet_settings (coin, address) VALUES
  ('btc', ''),
  ('eth', ''),
  ('usdt', '');
