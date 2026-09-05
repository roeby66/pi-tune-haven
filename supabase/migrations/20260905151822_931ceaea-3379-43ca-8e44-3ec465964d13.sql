CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  video_path text,
  thumbnail_url text,
  thumbnail_path text,
  duration_seconds integer,
  ad_type text NOT NULL DEFAULT 'HOUSE_PROMOTION',
  target_tier text NOT NULL DEFAULT 'ALL',
  priority integer NOT NULL DEFAULT 0,
  frequency_type text NOT NULL DEFAULT 'EVERY_N_SONGS',
  frequency_value integer,
  start_at timestamptz,
  end_at timestamptz,
  max_impressions integer,
  click_url text,
  status text NOT NULL DEFAULT 'DRAFT',
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ads_target_tier_check CHECK (target_tier IN ('FREE','STANDARD','PREMIUM','ALL')),
  CONSTRAINT ads_status_check CHECK (status IN ('DRAFT','ACTIVE','PAUSED','EXPIRED')),
  CONSTRAINT ads_frequency_type_check CHECK (frequency_type IN ('EVERY_SONG','EVERY_N_SONGS','TIME_INTERVAL','ONCE_PER_SESSION')),
  CONSTRAINT ads_ad_type_check CHECK (ad_type IN ('HOUSE_PROMOTION','ARTIST_PROMOTION','NEW_MUSIC','PREMIUM_PROMOTION','ANNOUNCEMENT'))
);

CREATE TABLE public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id text,
  session_id text,
  event_type text NOT NULL,
  played_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_impressions_event_type_check CHECK (event_type IN ('IMPRESSION','START','COMPLETE','SKIP','ERROR'))
);

CREATE TABLE public.ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ads TO service_role;
GRANT ALL ON public.ad_impressions TO service_role;
GRANT ALL ON public.ad_clicks TO service_role;

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ads" ON public.ads
  FOR SELECT TO authenticated
  USING (public.has_role(public.current_pi_uid(), 'admin'::app_role));

CREATE POLICY "Admins can view ad impressions" ON public.ad_impressions
  FOR SELECT TO authenticated
  USING (public.has_role(public.current_pi_uid(), 'admin'::app_role));

CREATE POLICY "Admins can view ad clicks" ON public.ad_clicks
  FOR SELECT TO authenticated
  USING (public.has_role(public.current_pi_uid(), 'admin'::app_role));

CREATE INDEX idx_ads_status ON public.ads(status);
CREATE INDEX idx_ads_target_tier ON public.ads(target_tier);
CREATE INDEX idx_ads_priority ON public.ads(priority DESC, sort_order ASC);
CREATE INDEX idx_ads_start_at ON public.ads(start_at);
CREATE INDEX idx_ads_end_at ON public.ads(end_at);
CREATE INDEX idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_created_at ON public.ad_impressions(created_at DESC);
CREATE INDEX idx_ad_impressions_user_recent ON public.ad_impressions(user_id, ad_id, created_at DESC);
CREATE INDEX idx_ad_clicks_ad_id ON public.ad_clicks(ad_id);
CREATE INDEX idx_ad_clicks_created_at ON public.ad_clicks(created_at DESC);

CREATE TRIGGER trg_ads_updated
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();