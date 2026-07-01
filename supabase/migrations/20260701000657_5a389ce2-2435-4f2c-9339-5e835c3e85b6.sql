
-- ============ ENUM ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============ pi_users ============
CREATE TABLE public.pi_users (
  uid TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  wallet_address TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.pi_users TO service_role;
ALTER TABLE public.pi_users ENABLE ROW LEVEL SECURITY;
-- No public policies: only service_role (server fns) can touch this table.

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.pi_users(uid) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_uid TEXT, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = _role
  );
$$;

-- ============ artists ============
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  genre TEXT,
  bio TEXT,
  cover_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artists TO anon, authenticated;
GRANT ALL ON public.artists TO service_role;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists are publicly readable" ON public.artists FOR SELECT TO anon, authenticated USING (true);

-- ============ songs ============
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  album TEXT,
  genre TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  audio_url TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  plays_count BIGINT NOT NULL DEFAULT 0,
  uploaded_by TEXT REFERENCES public.pi_users(uid) ON DELETE SET NULL,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.songs TO anon, authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Songs are publicly readable" ON public.songs FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX songs_artist_id_idx ON public.songs(artist_id);
CREATE INDEX songs_plays_idx ON public.songs(plays_count DESC);
CREATE INDEX songs_released_idx ON public.songs(released_at DESC);

-- ============ favorites ============
CREATE TABLE public.favorites (
  user_id TEXT NOT NULL REFERENCES public.pi_users(uid) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- ============ plays ============
CREATE TABLE public.plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.pi_users(uid) ON DELETE SET NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.plays TO service_role;
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;
CREATE INDEX plays_user_idx ON public.plays(user_id, played_at DESC);

-- ============ increment_plays helper ============
CREATE OR REPLACE FUNCTION public.increment_song_plays(_song_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.songs SET plays_count = plays_count + 1 WHERE id = _song_id;
$$;

-- ============ Seed the primary artist row for the mock catalog fallback ============
-- Real artists will be created via the admin upload flow.
