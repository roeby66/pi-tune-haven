import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdsAdmin,
  createAd,
  updateAd,
  setAdStatus,
  setAdSortOrder,
  duplicateAd,
  deleteAd,
  type AdListItem,
} from "@/lib/ads-admin.functions";

const AD_TYPES = [
  ["HOUSE_PROMOTION", "House Promotion"],
  ["ARTIST_PROMOTION", "Artist Promotion"],
  ["NEW_MUSIC", "New Music"],
  ["PREMIUM_PROMOTION", "Premium Promotion"],
  ["ANNOUNCEMENT", "Announcement"],
] as const;
const TIERS = ["FREE", "STANDARD", "PREMIUM", "ALL"] as const;
const FREQS = [
  ["EVERY_SONG", "Every Song"],
  ["EVERY_N_SONGS", "Every N Songs"],
  ["TIME_INTERVAL", "Time Interval"],
  ["ONCE_PER_SESSION", "Once Per Session"],
] as const;
const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"] as const;

const input =
  "w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60";
const label = "text-xs font-semibold text-muted-foreground";

function toLocalInput(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdsManagerTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<AdListItem | null>(null);

  const { data: ads, isLoading, error } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: () => listAdsAdmin(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-ads"] });

  const statusM = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) => setAdStatus({ data: v }),
    onSuccess: () => {
      toast.success("Ad status updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupM = useMutation({
    mutationFn: (id: string) => duplicateAd({ data: { id } }),
    onSuccess: () => {
      toast.success("Ad duplicated as draft");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteAd({ data: { id } }),
    onSuccess: () => {
      toast.success("Ad deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const orderM = useMutation({
    mutationFn: (order: { id: string; sort_order: number }[]) => setAdSortOrder({ data: { order } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  function move(list: AdListItem[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    orderM.mutate(next.map((ad, i) => ({ id: ad.id, sort_order: i })));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  const list = ads ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {list.length} advertisement{list.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          Create Advertisement
        </button>
      </div>

      {(creating || editing) && (
        <AdForm
          ad={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            invalidate();
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="p-2">Order</th>
              <th className="p-2">Advertisement</th>
              <th className="p-2">Type</th>
              <th className="p-2">Target</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Frequency</th>
              <th className="p-2">Status</th>
              <th className="p-2">Impr.</th>
              <th className="p-2">Clicks</th>
              <th className="p-2">Compl.</th>
              <th className="p-2">Dates</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((ad, i) => (
              <tr key={ad.id} className="border-t border-white/5">
                <td className="p-2">
                  <div className="flex flex-col">
                    <button onClick={() => move(list, i, -1)} aria-label="Move up">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => move(list, i, 1)} aria-label="Move down">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="p-2 font-semibold">{ad.title}</td>
                <td className="p-2">{ad.ad_type.replace(/_/g, " ").toLowerCase()}</td>
                <td className="p-2">{ad.target_tier}</td>
                <td className="p-2">{ad.priority}</td>
                <td className="p-2">
                  {ad.frequency_type.replace(/_/g, " ").toLowerCase()}
                  {ad.frequency_value ? ` (${ad.frequency_value})` : ""}
                </td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      ad.status === "ACTIVE"
                        ? "bg-primary/15 text-primary"
                        : "bg-white/10 text-muted-foreground"
                    }`}
                  >
                    {ad.status}
                  </span>
                </td>
                <td className="p-2">{ad.impressions}</td>
                <td className="p-2">
                  {ad.clicks} ({ad.ctr}%)
                </td>
                <td className="p-2">{ad.completionRate}%</td>
                <td className="p-2 whitespace-nowrap">
                  {ad.start_at ? new Date(ad.start_at).toLocaleDateString() : "—"} →{" "}
                  {ad.end_at ? new Date(ad.end_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(ad)} aria-label="Edit" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setPreview(ad)} aria-label="Preview" title="Preview">
                      <Megaphone className="h-3.5 w-3.5" />
                    </button>
                    {ad.status === "ACTIVE" ? (
                      <button
                        onClick={() => statusM.mutate({ id: ad.id, status: "PAUSED" })}
                        aria-label="Pause"
                        title="Pause"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => statusM.mutate({ id: ad.id, status: "ACTIVE" })}
                        aria-label="Activate"
                        title="Activate"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => dupM.mutate(ad.id)} aria-label="Duplicate" title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${ad.title}"? This cannot be undone.`))
                          delM.mutate(ad.id);
                      }}
                      aria-label="Delete"
                      title="Delete"
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={12} className="p-4 text-center text-muted-foreground">
                  No advertisements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-sm font-bold">{preview.title}</p>
            <video
              src={preview.video_url}
              poster={preview.thumbnail_url ?? undefined}
              controls
              className="w-full rounded-lg bg-black"
            />
            <button
              onClick={() => setPreview(null)}
              className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdForm({
  ad,
  onDone,
  onCancel,
}: {
  ad: AdListItem | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [freq, setFreq] = useState<string>(ad?.frequency_type ?? "EVERY_N_SONGS");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (ad) form.set("id", ad.id);
    setBusy(true);
    try {
      if (ad) await updateAd({ data: form });
      else await createAd({ data: form });
      toast.success(ad ? "Advertisement updated" : "Advertisement created");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-white/10 bg-background/40 p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label className={label}>Advertisement Title</label>
        <input name="title" defaultValue={ad?.title ?? ""} required maxLength={200} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Description</label>
        <textarea name="description" defaultValue={ad?.description ?? ""} className={input} rows={2} />
      </div>
      <div>
        <label className={label}>Advertisement Type</label>
        <select name="ad_type" defaultValue={ad?.ad_type ?? "HOUSE_PROMOTION"} className={input}>
          {AD_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Target Membership</label>
        <select name="target_tier" defaultValue={ad?.target_tier ?? "FREE"} className={input}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Video Upload {ad ? "(replace)" : ""}</label>
        <input type="file" name="video" accept="video/*" className={input} />
      </div>
      <div>
        <label className={label}>Thumbnail Upload</label>
        <input type="file" name="thumbnail" accept="image/*" className={input} />
      </div>
      <div>
        <label className={label}>Or Video URL</label>
        <input
          name="video_url"
          defaultValue={ad && !ad.video_path ? ad.video_url : ""}
          placeholder="https://…"
          className={input}
        />
      </div>
      <div>
        <label className={label}>Duration (seconds)</label>
        <input
          type="number"
          name="duration_seconds"
          min={1}
          defaultValue={ad?.duration_seconds ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className={label}>Priority</label>
        <input type="number" name="priority" defaultValue={ad?.priority ?? 0} className={input} />
      </div>
      <div>
        <label className={label}>Sort Order</label>
        <input type="number" name="sort_order" defaultValue={ad?.sort_order ?? 0} className={input} />
      </div>
      <div>
        <label className={label}>Frequency Type</label>
        <select
          name="frequency_type"
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          className={input}
        >
          {FREQS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {(freq === "EVERY_N_SONGS" || freq === "TIME_INTERVAL") && (
        <div>
          <label className={label}>
            {freq === "EVERY_N_SONGS" ? "Number of Songs" : "Interval in minutes"}
          </label>
          <input
            type="number"
            name="frequency_value"
            min={1}
            defaultValue={ad?.frequency_value ?? (freq === "EVERY_N_SONGS" ? 3 : 15)}
            className={input}
            required
          />
        </div>
      )}
      <div>
        <label className={label}>Start Date</label>
        <input
          type="datetime-local"
          name="start_at"
          defaultValue={toLocalInput(ad?.start_at ?? null)}
          className={input}
        />
      </div>
      <div>
        <label className={label}>End Date</label>
        <input
          type="datetime-local"
          name="end_at"
          defaultValue={toLocalInput(ad?.end_at ?? null)}
          className={input}
        />
      </div>
      <div>
        <label className={label}>Maximum Impressions</label>
        <input
          type="number"
          name="max_impressions"
          min={1}
          defaultValue={ad?.max_impressions ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className={label}>Click URL</label>
        <input name="click_url" defaultValue={ad?.click_url ?? ""} placeholder="https://…" className={input} />
      </div>
      <div>
        <label className={label}>Status</label>
        <select name="status" defaultValue={ad?.status ?? "DRAFT"} className={input}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : ad ? "Save changes" : "Create advertisement"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
