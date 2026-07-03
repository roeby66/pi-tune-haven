
-- =========================================
-- Enum types
-- =========================================
DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('pending','active','expired','cancelled','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','completed','cancelled','failed','expired','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- Timestamp trigger helper (shared)
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================
-- membership_plans (public catalog)
-- =========================================
CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price numeric(20,8) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PI',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  duration_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON public.membership_plans FOR SELECT USING (true);
CREATE TRIGGER trg_membership_plans_updated BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- user_memberships
-- =========================================
CREATE TABLE public.user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid text NOT NULL,
  membership_plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  membership_level text NOT NULL,
  membership_status public.membership_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  renewal_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_memberships_user ON public.user_memberships(user_uid);
CREATE INDEX idx_user_memberships_active
  ON public.user_memberships(user_uid) WHERE membership_status = 'active';
GRANT ALL ON public.user_memberships TO service_role;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_user_memberships_updated BEFORE UPDATE ON public.user_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- membership_payments
-- =========================================
CREATE TABLE public.membership_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text NOT NULL UNIQUE,
  transaction_id text,
  user_uid text NOT NULL,
  membership_plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  amount numeric(20,8) NOT NULL,
  currency text NOT NULL DEFAULT 'PI',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'pi_network',
  memo text,
  tx_hash text,
  paid_at timestamptz,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_membership_payments_user ON public.membership_payments(user_uid);
CREATE INDEX idx_membership_payments_status ON public.membership_payments(payment_status);
GRANT ALL ON public.membership_payments TO service_role;
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_membership_payments_updated BEFORE UPDATE ON public.membership_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- membership_history
-- =========================================
CREATE TABLE public.membership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid text NOT NULL,
  previous_plan text,
  new_plan text,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_membership_history_user ON public.membership_history(user_uid);
GRANT ALL ON public.membership_history TO service_role;
ALTER TABLE public.membership_history ENABLE ROW LEVEL SECURITY;

-- =========================================
-- payment_logs
-- =========================================
CREATE TABLE public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text,
  event_type text NOT NULL,
  event_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_logs_payment ON public.payment_logs(payment_id);
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- Seed initial plans
-- =========================================
INSERT INTO public.membership_plans (name, display_name, description, price, currency, billing_cycle, duration_days, sort_order, benefits)
VALUES
  ('standard_monthly','Standard','Great for casual listeners. Ad-free streaming and offline queue.',0.10,'PI','monthly',30,1,
    '["Ad-free streaming","Standard audio quality","Save unlimited favorites","Offline queue"]'::jsonb),
  ('premium_monthly','Premium','For true Pioneers. Everything in Standard plus HQ audio and early releases.',0.50,'PI','monthly',30,2,
    '["Everything in Standard","High-quality audio","Early access to new releases","Support independent artists","Premium badge on profile"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
