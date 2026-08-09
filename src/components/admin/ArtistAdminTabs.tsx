import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, Mic2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listArtistApplications,
  reviewArtistApplication,
  listApprovedArtists,
  setArtistProfileStatus,
  listSongVerifications,
  setSongVerification,
  getVerificationDownloadUrl,
  listVerificationDownloadLogs,
} from "@/lib/artist-admin.functions";

const box = "rounded-2xl border border-white/10 bg-card/60 p-4 sm:p-5";
const inputCls =
  "w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60";

const VERIFY_STATUSES = [
  { id: "pending_verification", label: "Pending Verification" },
  { id: "verified", label: "Verified" },
  { id: "needs_review", label: "Needs Review" },
  { id: "rejected", label: "Rejected" },
] as const;

function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
}

export function ArtistApplicationsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["admin", "applications", filter],
    queryFn: () => listArtistApplications({ data: { status: filter } }),
  });
  const review = useMutation({
    mutationFn: (v: { id: string; approve: boolean; reason?: string }) =>
      reviewArtistApplication({ data: v }),
    onSuccess: (r) => {
      toast.success(r.status === "approved" ? "Application approved" : "Application rejected");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className={box}>
      <div className="mb-4 flex items-center gap-2">
        <Mic2 className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Artist Applications</h2>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f ? "bg-primary text-primary-foreground" : "border border-white/10 bg-background/40"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Spinner />
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          No applications here.
        </p>
      ) : (
        <div className="space-y-3">
          {q.data!.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {a.artist_name}{" "}
                    <span className="font-normal text-muted-foreground">@{a.username}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.genre ?? "—"} · {a.membership ?? "no membership"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      a.status === "approved"
                        ? "bg-primary/15 text-primary"
                        : a.status === "rejected"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {a.status}
                  </span>
                  <button
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold"
                  >
                    View
                  </button>
                </div>
              </div>

              {openId === a.id && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs">
                  <p><strong>Full name:</strong> {a.full_name}</p>
                  <p><strong>Location:</strong> {a.location ?? "—"}</p>
                  <p><strong>Bio:</strong> {a.bio ?? "—"}</p>
                  {a.description && <p><strong>Description:</strong> {a.description}</p>}
                  <p className="flex flex-wrap gap-2">
                    {Object.entries(a.social_links ?? {})
                      .filter(([, v]) => !!v)
                      .map(([k, v]) => (
                        <a key={k} href={v} target="_blank" rel="noreferrer" className="text-primary underline">
                          {k}
                        </a>
                      ))}
                  </p>
                  <p>
                    <strong>Originality declaration:</strong>{" "}
                    {a.copyright_declaration_accepted ? "accepted" : "not accepted"}
                    {a.copyright_declaration_accepted_at &&
                      ` · ${new Date(a.copyright_declaration_accepted_at).toLocaleString()}`}
                  </p>
                  {a.avatarUrl && (
                    <img src={a.avatarUrl} alt={a.artist_name} className="h-20 w-20 rounded-lg object-cover" />
                  )}
                  {a.demoUrl && <audio src={a.demoUrl} controls className="w-full" />}
                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="text-destructive"><strong>Reason:</strong> {a.rejection_reason}</p>
                  )}

                  {a.status === "pending" && (
                    <div className="space-y-2 pt-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Rejection reason (required to reject)"
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={review.isPending}
                          onClick={() => {
                            if (confirm(`Approve ${a.artist_name} as an artist?`))
                              review.mutate({ id: a.id, approve: true });
                          }}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={review.isPending}
                          onClick={() => {
                            if (!reason.trim()) return toast.error("Rejection reason is required");
                            review.mutate({ id: a.id, approve: false, reason });
                          }}
                          className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ApprovedArtistsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "approvedArtists"], queryFn: () => listApprovedArtists() });
  const setStatus = useMutation({
    mutationFn: (v: { profileId: string; status: "active" | "suspended" }) =>
      setArtistProfileStatus({ data: v }),
    onSuccess: () => {
      toast.success("Artist status updated");
      qc.invalidateQueries({ queryKey: ["admin", "approvedArtists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className={box}>
      <div className="mb-4 flex items-center gap-2">
        <Mic2 className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Artists (approved)</h2>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          No approved artists yet.
        </p>
      ) : (
        <div className="space-y-3">
          {q.data!.map((a) => (
            <div key={a.profileId} className="rounded-xl border border-white/10 bg-background/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {a.artistName} <span className="font-normal text-muted-foreground">@{a.username}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.genre ?? "—"} · {a.songCount} songs · {a.totalPlays} plays
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      a.status === "active" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {a.status}
                  </span>
                  <button
                    onClick={() => setSelected(selected === a.profileId ? null : a.profileId)}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold"
                  >
                    View songs
                  </button>
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => {
                      const next = a.status === "active" ? "suspended" : "active";
                      if (confirm(`Set ${a.artistName} to ${next}?`))
                        setStatus.mutate({ profileId: a.profileId, status: next });
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold"
                  >
                    {a.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                </div>
              </div>
              {selected === a.profileId && a.artistId && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <SongVerificationList artistId={a.artistId} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SongVerificationTab() {
  const [status, setStatus] = useState<string>("all");
  const logs = useQuery({ queryKey: ["admin", "verifyLogs"], queryFn: () => listVerificationDownloadLogs() });
  return (
    <div className="space-y-5">
      <section className={box}>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Song Verification</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", ...VERIFY_STATUSES.map((v) => v.id)] as string[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === s ? "bg-primary text-primary-foreground" : "border border-white/10 bg-background/40"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <SongVerificationList status={status} />
      </section>

      <section={undefined as never} />
      <section className={box}>
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Verification Download Log</h2>
        </div>
        {logs.isLoading ? (
          <Spinner />
        ) : (logs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No verification downloads recorded.</p>
        ) : (
          <div className="space-y-1 text-xs">
            {logs.data!.map((l) => (
              <div key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1">
                <span className="truncate">
                  {l.songTitle} · {l.artistName}
                </span>
                <span className="text-muted-foreground">
                  {l.action} · {new Date(l.downloadedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SongVerificationList({ artistId, status }: { artistId?: string; status?: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin", "songVerifications", artistId ?? "all", status ?? "all"],
    queryFn: () => listSongVerifications({ data: { artistId, status } }),
  });
  const save = useMutation({
    mutationFn: (v: { songId: string; status: "pending_verification" | "verified" | "needs_review" | "rejected"; notes?: string }) =>
      setSongVerification({ data: v }),
    onSuccess: () => {
      toast.success("Verification updated");
      qc.invalidateQueries({ queryKey: ["admin", "songVerifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const download = useMutation({
    mutationFn: (songId: string) => getVerificationDownloadUrl({ data: { songId } }),
    onSuccess: (r) => {
      window.open(r.url, "_blank", "noopener");
      toast.success("Download started — logged for audit");
      qc.invalidateQueries({ queryKey: ["admin", "verifyLogs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if ((q.data ?? []).length === 0)
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
        No songs here.
      </p>
    );

  return (
    <div className="space-y-3">
      {q.data!.map((s) => (
        <div key={s.songId} className="rounded-xl border border-white/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {s.artistName} · {s.plays} plays · {s.downloadCount} verification downloads
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                s.status === "verified"
                  ? "bg-primary/15 text-primary"
                  : s.status === "rejected"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-amber-500/15 text-amber-500"
              }`}
            >
              {s.status.replace(/_/g, " ")}
            </span>
          </div>

          <textarea
            rows={2}
            defaultValue={s.notes ?? ""}
            onChange={(e) => setNotes((p) => ({ ...p, [s.songId]: e.target.value }))}
            placeholder="Internal verification notes (admin only)"
            className={`mt-2 ${inputCls}`}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {VERIFY_STATUSES.map((v) => (
              <button
                key={v.id}
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({ songId: s.songId, status: v.id, notes: notes[s.songId] ?? s.notes ?? "" })
                }
                className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold disabled:opacity-60"
              >
                {v.label}
              </button>
            ))}
            <button
              disabled={download.isPending}
              onClick={() => download.mutate(s.songId)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" /> Download for Verification
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
