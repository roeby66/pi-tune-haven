ALTER TABLE public.pi_users DROP CONSTRAINT IF EXISTS pi_users_username_key;
CREATE INDEX IF NOT EXISTS pi_users_username_idx ON public.pi_users (username);