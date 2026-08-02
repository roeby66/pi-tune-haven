REVOKE EXECUTE ON FUNCTION public.current_pi_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_pi_uid() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.increment_song_plays(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_song_plays(uuid) TO authenticated, service_role;