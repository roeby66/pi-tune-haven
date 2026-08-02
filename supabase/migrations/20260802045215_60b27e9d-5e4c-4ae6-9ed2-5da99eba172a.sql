ALTER TABLE public.pi_users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.current_pi_uid()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uid FROM public.pi_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_pi_uid() TO authenticated;

GRANT SELECT, UPDATE ON public.pi_users TO authenticated;
GRANT ALL ON public.pi_users TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
GRANT SELECT, INSERT ON public.plays TO authenticated;
GRANT ALL ON public.plays TO service_role;
GRANT SELECT ON public.user_memberships TO authenticated;
GRANT ALL ON public.user_memberships TO service_role;
GRANT SELECT ON public.membership_payments TO authenticated;
GRANT ALL ON public.membership_payments TO service_role;
GRANT SELECT ON public.membership_history TO authenticated;
GRANT ALL ON public.membership_history TO service_role;

ALTER TABLE public.pi_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pi profile" ON public.pi_users;
CREATE POLICY "Users can view their own pi profile" ON public.pi_users
FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
CREATE POLICY "Users can view their own favorites" ON public.favorites
FOR SELECT TO authenticated USING (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can add their own favorites" ON public.favorites;
CREATE POLICY "Users can add their own favorites" ON public.favorites
FOR INSERT TO authenticated WITH CHECK (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can remove their own favorites" ON public.favorites;
CREATE POLICY "Users can remove their own favorites" ON public.favorites
FOR DELETE TO authenticated USING (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can view their own plays" ON public.plays;
CREATE POLICY "Users can view their own plays" ON public.plays
FOR SELECT TO authenticated USING (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can record their own plays" ON public.plays;
CREATE POLICY "Users can record their own plays" ON public.plays
FOR INSERT TO authenticated WITH CHECK (user_id = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can view their own membership" ON public.user_memberships;
CREATE POLICY "Users can view their own membership" ON public.user_memberships
FOR SELECT TO authenticated USING (user_uid = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can view their own payments" ON public.membership_payments;
CREATE POLICY "Users can view their own payments" ON public.membership_payments
FOR SELECT TO authenticated USING (user_uid = public.current_pi_uid());

DROP POLICY IF EXISTS "Users can view their own membership history" ON public.membership_history;
CREATE POLICY "Users can view their own membership history" ON public.membership_history
FOR SELECT TO authenticated USING (user_uid = public.current_pi_uid());