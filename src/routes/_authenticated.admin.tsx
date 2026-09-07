import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Mic2,
  Music,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useAuth, type AppUser } from "@/contexts/AuthContext";
import {
  uploadSong,
  deleteSong,
  listAllSongsAdmin,
  listArtistsAdmin,
  setArtistVerified,
  listUsersAdmin,
  setUserAdminRole,
  listMembershipsAdmin,
  getAdminStats,
} from "@/lib/admin.functions";
import {
  ArtistApplicationsTab,
  ApprovedArtistsTab,
  SongVerificationTab,
} from "@/components/admin/ArtistAdminTabs";

export const Route = createFileRoute("/_authenticated/admin")({
  // Admin state lives in the client-side Pi/Supabase session, so never
  // pre-render this subtree on the server.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Panel — MyPiMusic" },
      { name: "description", content: "Manage MyPiMusic music, artists, users and memberships." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminGate,
});


const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "music", label: "Music", icon: Music },
  { id: "artists", label: "Artists", icon: Mic2 },
  { id: "applications", label: "Artist Applications", icon: Mic2 },
  { id: "approvedArtists", label: "Approved Artists", icon: Mic2 },
  { id: "verification", label: "Song Verification", icon: Shield },
  { id: "users", label: "Users", icon: Users },
  { id: "memberships", label: "Memberships", icon: CreditCard },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ads", label: "Ads Manager", icon: Megaphone },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Panel({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: React.ElementType }) {
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

/**
 * Hard gate: the admin UI module below is only ever mounted once we know the
 * signed-in user has the admin role AND a live Supabase session. Non-admins
 * never render a single frame of the panel — no flash, no admin data fetches.
 */
function AdminGate() {
  const { isAdmin, user, status, hasSupabaseSession } = useAuth();
  const router = useRouter();

  // Still resolving the session — render nothing (the outer layout already
  // shows the login screen when unauthenticated).
  if (status === "loading") {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user || status !== "authenticated" || !hasSupabaseSession || !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <Shield className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-lg font-bold">Admins only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <button
          onClick={() => router.navigate({ to: "/home" })}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go home
        </button>
      </div>
    );
  }

  return <AdminPage user={user} />;
}

function AdminPage({ user }: { user: AppUser }) {
  const [tab, setTab] = useState<TabId>("dashboard");





  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-white/10 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "music" && <MusicTab />}
      {tab === "artists" && <ArtistsTab />}
      {tab === "applications" && <ArtistApplicationsTab />}
      {tab === "approvedArtists" && <ApprovedArtistsTab />}
      {tab === "verification" && <SongVerificationTab />}
      {tab === "users" && <UsersTab currentUid={user.uid} />}
      {tab === "memberships" && <MembershipsTab />}
      {tab === "upload" && <UploadTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "settings" && <SettingsTab username={user.username} uid={user.uid} />}
    </div>
  );
}

function useStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: () => getAdminStats() });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card/70 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function DashboardTab() {
  const q = useStats();
  if (q.isLoading) return <Loading />;
  const s = q.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Songs" value={s?.songs ?? 0} />
        <StatCard label="Artists" value={s?.artists ?? 0} />
        <StatCard label="Pioneers" value={s?.users ?? 0} />
        <StatCard label="Active members" value={s?.activeMembers ?? 0} />
        <StatCard label="Total plays" value={s?.plays ?? 0} />
        <StatCard label="Favorites" value={s?.favorites ?? 0} />
        <StatCard label="Revenue (Pi)" value={(s?.revenue ?? 0).toFixed(2)} />
      </div>
      <Panel title="Top songs" icon={BarChart3}>
        {(s?.topSongs.length ?? 0) === 0 ? (
          <Empty>No plays recorded yet.</Empty>
        ) : (
          <ol className="space-y-2">
            {s!.topSongs.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                <span className="truncate text-xs text-muted-foreground">{t.artist}</span>
                <span className="text-xs font-semibold text-primary">{t.plays}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function MusicTab() {
  const qc = useQueryClient();
  const songsQ = useQuery({ queryKey: ["admin", "songs"], queryFn: () => listAllSongsAdmin() });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteSong({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });

  return (
    <Panel title={`All songs (${songsQ.data?.length ?? 0})`} icon={Music}>
      {songsQ.isLoading ? (
        <Loading />
      ) : (songsQ.data?.length ?? 0) === 0 ? (
        <Empty>No songs uploaded yet.</Empty>
      ) : (
        <div className="divide-y divide-white/5">
          {songsQ.data!.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.artist} · {s.plays.toLocaleString()} plays{s.genre ? ` · ${s.genre}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete "${s.title}"? This cannot be undone.`)) deleteMut.mutate(s.id);
                }}
                disabled={deleteMut.isPending}
                className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                aria-label={`Delete ${s.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ArtistsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "artists"], queryFn: () => listArtistsAdmin() });
  const verify = useMutation({
    mutationFn: (v: { id: string; verified: boolean }) => setArtistVerified({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "artists"] }),
  });

  return (
    <Panel title={`Artists (${q.data?.length ?? 0})`} icon={Mic2}>
      {q.isLoading ? (
        <Loading />
      ) : (q.data?.length ?? 0) === 0 ? (
        <Empty>No artists yet.</Empty>
      ) : (
        <div className="divide-y divide-white/5">
          {q.data!.map((a) => (
            <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.songCount} song{a.songCount === 1 ? "" : "s"}
                  {a.genre ? ` · ${a.genre}` : ""}
                </p>
              </div>
              <button
                onClick={() => verify.mutate({ id: a.id, verified: !a.verified })}
                disabled={verify.isPending}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                  a.verified
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-white/10 bg-card/70 text-muted-foreground"
                }`}
              >
                {a.verified ? "Verified" : "Verify"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function UsersTab({ currentUid }: { currentUid: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsersAdmin() });
  const roleMut = useMutation({
    mutationFn: (v: { uid: string; makeAdmin: boolean }) => setUserAdminRole({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <Panel title={`Pioneers (${q.data?.length ?? 0})`} icon={Users}>
      {q.isLoading ? (
        <Loading />
      ) : (q.data?.length ?? 0) === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        <div className="divide-y divide-white/5">
          {q.data!.map((u) => {
            const admin = u.roles.includes("admin");
            return (
              <div key={u.uid} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">@{u.username}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Joined {new Date(u.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => roleMut.mutate({ uid: u.uid, makeAdmin: !admin })}
                  disabled={roleMut.isPending || u.uid === currentUid}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                    admin
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/10 bg-card/70 text-muted-foreground"
                  }`}
                >
                  {admin ? "Admin" : "Make admin"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function MembershipsTab() {
  const q = useQuery({ queryKey: ["admin", "memberships"], queryFn: () => listMembershipsAdmin() });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <Panel title="Plans" icon={CreditCard}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(d?.plans ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-card/70 p-3">
              <p className="text-sm font-bold">{p.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {Number(p.price).toFixed(2)} {p.currency} / {p.billing_cycle} ·{" "}
                {p.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={`Subscribers (${d?.memberships.length ?? 0})`} icon={Users}>
        {(d?.memberships.length ?? 0) === 0 ? (
          <Empty>No memberships yet.</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {d!.memberships.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{m.user_uid}</span>
                <span className="text-xs font-semibold">{m.membership_level}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {m.membership_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Recent payments" icon={CreditCard}>
        {(d?.payments.length ?? 0) === 0 ? (
          <Empty>No payments recorded.</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {d!.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-mono">{p.payment_id}</span>
                <span className="font-semibold">
                  {Number(p.amount).toFixed(2)} {p.currency}
                </span>
                <span className="text-muted-foreground">{p.payment_status}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AnalyticsTab() {
  const q = useStats();
  if (q.isLoading) return <Loading />;
  const s = q.data;
  const avgPlays = s && s.songs > 0 ? (s.plays / s.songs).toFixed(1) : "0";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total plays" value={s?.plays ?? 0} />
        <StatCard label="Avg plays / song" value={avgPlays} />
        <StatCard label="Favorites" value={s?.favorites ?? 0} />
        <StatCard label="Revenue (Pi)" value={(s?.revenue ?? 0).toFixed(2)} />
      </div>
      <Panel title="Most played" icon={BarChart3}>
        {(s?.topSongs.length ?? 0) === 0 ? (
          <Empty>Not enough data yet.</Empty>
        ) : (
          <div className="space-y-3">
            {s!.topSongs.map((t) => {
              const max = Math.max(...s!.topSongs.map((x) => x.plays), 1);
              return (
                <div key={t.id}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate font-semibold">{t.title}</span>
                    <span className="text-muted-foreground">{t.plays}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${(t.plays / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsTab({ username, uid }: { username: string; uid: string }) {
  return (
    <Panel title="Settings" icon={Settings}>
      <dl className="space-y-2 text-sm">
        <Row label="Signed in as" value={`@${username}`} />
        <Row label="Pi UID" value={uid} mono />
        <Row label="Payment network" value="Pi Testnet" />
        <Row label="Storage buckets" value="songs, covers" />
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Platform configuration (Pi API keys, session secrets) is managed securely on the server and
        cannot be edited from this panel.
      </p>
    </Panel>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-xs font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs text-muted-foreground">{children}</p>;
}

function UploadTab() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const uploadMut = useMutation({
    mutationFn: async (fd: FormData) => uploadSong({ data: fd }),
    onSuccess: () => {
      setMessage("Song uploaded successfully.");
      setError(null);
      formRef.current?.reset();
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
    onError: (e: Error) => {
      setError(e.message || "Upload failed");
      setMessage(null);
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const audioFile = fd.get("audio");
    if (audioFile instanceof File && audioFile.size > 0) {
      try {
        const duration = await readAudioDuration(audioFile);
        fd.set("duration", String(duration));
      } catch {
        /* leave as 0 */
      }
    }
    uploadMut.mutate(fd);
  }

  return (
    <Panel title="Upload a song" icon={Upload}>
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Song title *"
            aria-label="Song title"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            name="artist"
            required
            maxLength={120}
            placeholder="Artist name *"
            aria-label="Artist name"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            name="album"
            maxLength={200}
            placeholder="Album (optional)"
            aria-label="Album"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            name="genre"
            maxLength={64}
            placeholder="Genre (optional)"
            aria-label="Genre"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
        </div>

        <label className="block text-xs text-muted-foreground">
          Audio file (MP3/WAV/OGG, up to 30 MB) *
          <input
            type="file"
            name="audio"
            accept="audio/*"
            required
            className="mt-1 block w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground"
          />
        </label>

        <label className="block text-xs text-muted-foreground">
          Cover image (JPG/PNG, up to 5 MB, optional)
          <input
            type="file"
            name="cover"
            accept="image/*"
            className="mt-1 block w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={uploadMut.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
        >
          {uploadMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploadMut.isPending ? "Uploading…" : "Upload song"}
        </button>
      </form>
    </Panel>
  );
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read_duration_failed"));
    };
  });
}
