-- Enums
CREATE TYPE public.artist_application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.artist_profile_status AS ENUM ('active','suspended');
CREATE TYPE public.song_verification_status AS ENUM ('pending_verification','verified','needs_review','rejected');

-- Artist applications
CREATE TABLE public.artist_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.pi_users(uid) ON DELETE CASCADE,
  artist_name text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  bio text,
  genre text,
  location text,
  description text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  demo_url text,
  status public.artist_application_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  guidelines_accepted boolean NOT NULL DEFAULT false,
  copyright_declaration_accepted boolean NOT NULL DEFAULT false,
  copyright_declaration_accepted_at timestamptz,
  reviewed_by text REFERENCES public.pi_users(uid),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX artist_applications_one_pending
  ON public.artist_applications (user_id) WHERE status = 'pending';
CREATE INDEX artist_applications_status_idx ON public.artist_applications (status, created_at DESC);

GRANT SELECT, INSERT ON public.artist_applications TO authenticated;
GRANT ALL ON public.artist_applications TO service_role;
ALTER TABLE public.artist_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own applications" ON public.artist_applications
  FOR SELECT TO authenticated USING (user_id = public.current_pi_uid());
CREATE POLICY "Admins can view all applications" ON public.artist_applications
  FOR SELECT TO authenticated USING (public.has_role(public.current_pi_uid(), 'admin'));

-- Artist profiles
CREATE TABLE public.artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES public.pi_users(uid) ON DELETE CASCADE,
  application_id uuid REFERENCES public.artist_applications(id) ON DELETE SET NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  artist_name text NOT NULL,
  bio text,
  avatar_url text,
  genre text,
  location text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.artist_profile_status NOT NULL DEFAULT 'active',
  pioneer_artist boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artist_profiles TO authenticated;
GRANT ALL ON public.artist_profiles TO service_role;
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own artist profile" ON public.artist_profiles
  FOR SELECT TO authenticated USING (user_id = public.current_pi_uid());
CREATE POLICY "Admins can view all artist profiles" ON public.artist_profiles
  FOR SELECT TO authenticated USING (public.has_role(public.current_pi_uid(), 'admin'));

-- Song verifications (internal notes: admin-only)
CREATE TABLE public.song_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL UNIQUE REFERENCES public.songs(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  status public.song_verification_status NOT NULL DEFAULT 'pending_verification',
  verification_notes text,
  reviewed_by text REFERENCES public.pi_users(uid),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX song_verifications_status_idx ON public.song_verifications (status, created_at DESC);
GRANT SELECT ON public.song_verifications TO authenticated;
GRANT ALL ON public.song_verifications TO service_role;
ALTER TABLE public.song_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view song verifications" ON public.song_verifications
  FOR SELECT TO authenticated USING (public.has_role(public.current_pi_uid(), 'admin'));

-- Verification download audit log (admin-only)
CREATE TABLE public.verification_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL REFERENCES public.pi_users(uid),
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'verification_download',
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_download_logs_song_idx ON public.verification_download_logs (song_id, downloaded_at DESC);
GRANT SELECT ON public.verification_download_logs TO authenticated;
GRANT ALL ON public.verification_download_logs TO service_role;
ALTER TABLE public.verification_download_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view download logs" ON public.verification_download_logs
  FOR SELECT TO authenticated USING (public.has_role(public.current_pi_uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_artist_applications_updated BEFORE UPDATE ON public.artist_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_artist_profiles_updated BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_song_verifications_updated BEFORE UPDATE ON public.song_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Every song gets a verification record automatically
CREATE OR REPLACE FUNCTION public.create_song_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.song_verifications (song_id, artist_id)
  VALUES (NEW.id, NEW.artist_id)
  ON CONFLICT (song_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_songs_create_verification AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.create_song_verification();

-- Backfill verification rows for existing songs
INSERT INTO public.song_verifications (song_id, artist_id, status)
SELECT id, artist_id, 'verified' FROM public.songs
ON CONFLICT (song_id) DO NOTHING;

-- Storage bucket policies for artist demo uploads reuse existing private buckets.