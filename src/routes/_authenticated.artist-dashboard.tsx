import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BarChart3, Disc3, Loader2, Mic2, Music, Upload, User } from "lucide-react";
import { toast } from "sonner";
import {
  getArtistStatus,
  getMyArtistAnalytics,
  listMyArtistSongs,
  updateMyArtistProfile,
  uploadArtistSong,
} from "@/lib/artist.functions";

export const Route = createFileRoute("/_authenticated/artist-dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Artist Dashboard — MyPiMusic" },
      { name: "description", content: "Manage your MyPiMusic artist profile, songs, albums and analytics." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArtistDashboardGate,
});

const inputCls =
  "w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "songs", label: "Songs", icon: Music },
  { id: "albums", label: "Albums", icon: Disc3 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

const VERIFY_LABEL: Record<string, string> = {
  pending_verification: "Pending Verification",
  verified: "Verified · Published",
  needs_review: "Needs Review",
  rejected: "Rejected",
};

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ArtistDashboardGate() {
  const status = useQuery({ queryKey: ["artist", "status"], queryFn: () => getArtistStatus() });

  if (status.isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const profile = status.data?.profile;
  if (!profile) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-card/60 p-6 text-center">
        <Mic2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 text-lg font-bold">Artist Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dashboard ini hanya untuk artis yang telah disetujui.
        </p>
        <Link
          to="/become-artist"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          🎤 Become an Artist
        </Link>
      </div>
    );
  }

  if (profile.status === "suspended") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h1 className="text-lg font-bold">Akun artis ditangguhkan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Akun artis Anda sedang ditangguhkan oleh Admin. Silakan hubungi Admin.
        </p>
      </div>
    );
  }

  return <ArtistDashboard profile={profile} />;
}

type Profile = NonNullable<Awaited<ReturnType<typeof getArtistStatus>>["profile"]>;

function ArtistDashboard({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-purple">
        <div className="flex items-center gap-3">
          <Mic2 className="h-6 w-6" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">{profile.artist_name}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 font-semibold">
                Artist Dashboard
              </span>
              {profile.pioneer_artist && (
                <span className="rounded-full bg-primary-foreground/25 px-2 py-0.5 font-semibold">
                  🎵 Pioneer Artist
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === id ? "bg-primary text-primary-foreground" : "border border-white/10 bg-card/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab profile={profile} />}
      {tab === "songs" && <SongsTab />}
      {tab === "albums" && <AlbumsTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

function ProfileTab({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (v: Record<string, string>) => updateMyArtistProfile({ data: v }),
    onSuccess: () => {
      toast.success("Profil artis diperbarui");
      qc.invalidateQueries({ queryKey: ["artist", "status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = profile.social_links ?? {};

  return (
    <Panel title="Artist Profile" icon={User}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.mutate(Object.fromEntries(fd) as Record<string, string>);
        }}
      >
        <label className="text-sm">
          Genre
          <input name="genre" defaultValue={profile.genre ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm">
          Kota / Negara
          <input name="location" defaultValue={profile.location ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm sm:col-span-2">
          Bio
          <textarea name="bio" rows={4} defaultValue={profile.bio ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm">
          YouTube
          <input name="youtube" defaultValue={s.youtube ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm">
          Instagram
          <input name="instagram" defaultValue={s.instagram ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm">
          TikTok
          <input name="tiktok" defaultValue={s.tiktok ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-sm">
          Spotify / lainnya
          <input name="music" defaultValue={s.music ?? ""} className={`mt-1 ${inputCls}`} />
        </label>
        <div className="sm:col-span-2">
          <button
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Profil
          </button>
        </div>
      </form>
    </Panel>
  );
}

function SongsTab() {
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const songs = useQuery({ queryKey: ["artist", "songs"], queryFn: () => listMyArtistSongs() });
  const upload = useMutation({
    mutationFn: (fd: FormData) => uploadArtistSong({ data: fd }),
    onSuccess: () => {
      toast.success("Lagu diunggah — menunggu verifikasi Admin");
      formRef.current?.reset();
      qc.invalidateQueries({ queryKey: ["artist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Panel title="Upload Song" icon={Upload}>
        <form
          ref={formRef}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("copyrightAccepted", fd.get("copyrightAccepted") ? "true" : "false");
            if (fd.get("copyrightAccepted") !== "true") {
              toast.error("Anda harus menyetujui pernyataan keaslian karya.");
              return;
            }
            upload.mutate(fd);
          }}
        >
          <label className="text-sm">
            Judul *
            <input name="title" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-sm">
            Album
            <input name="album" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-sm">
            Genre
            <input name="genre" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-sm">
            Durasi (detik)
            <input name="duration" type="number" min={0} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-sm">
            File Audio * (maks 30MB)
            <input name="audio" type="file" accept="audio/*" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-sm">
            Cover (maks 5MB)
            <input name="cover" type="file" accept="image/*" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="flex items-start gap-2 text-xs sm:col-span-2">
            <input type="checkbox" name="copyrightAccepted" className="mt-0.5" />
            <span>
              Saya menyatakan bahwa karya ini orisinal / saya memiliki hak sah untuk
              mendistribusikannya di MyPiMusic.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={upload.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Manage Songs" icon={Music}>
        {songs.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : songs.isError ? (
          <p className="text-sm text-destructive">{(songs.error as Error).message}</p>
        ) : (songs.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
            Belum ada lagu. Unggah lagu pertama Anda.
          </p>
        ) : (
          <div className="space-y-2">
            {songs.data!.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.album ?? "Single"} · {s.plays} plays
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    s.verificationStatus === "verified"
                      ? "bg-primary/15 text-primary"
                      : s.verificationStatus === "rejected"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {VERIFY_LABEL[s.verificationStatus] ?? s.verificationStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AlbumsTab() {
  const stats = useQuery({ queryKey: ["artist", "analytics"], queryFn: () => getMyArtistAnalytics() });
  if (stats.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const albums = stats.data?.albums ?? [];
  return (
    <Panel title="Manage Albums" icon={Disc3}>
      {albums.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          Belum ada album. Album dibuat otomatis dari nama album pada lagu Anda.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {albums.map((a) => (
            <div key={a.name} className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.songs} lagu · {a.plays} plays
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AnalyticsTab() {
  const stats = useQuery({ queryKey: ["artist", "analytics"], queryFn: () => getMyArtistAnalytics() });
  if (stats.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (stats.isError) return <p className="text-sm text-destructive">{(stats.error as Error).message}</p>;
  const d = stats.data!;
  const cards = [
    { label: "Total Songs", value: d.totalSongs },
    { label: "Published", value: d.publishedSongs },
    { label: "In Review", value: d.pendingSongs },
    { label: "Total Plays", value: d.totalPlays },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>
      <Panel title="Play Statistics" icon={BarChart3}>
        {d.topSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada statistik pemutaran.</p>
        ) : (
          <div className="space-y-2">
            {d.topSongs.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {i + 1}. {s.title}
                </span>
                <span className="text-muted-foreground">{s.plays} plays</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
