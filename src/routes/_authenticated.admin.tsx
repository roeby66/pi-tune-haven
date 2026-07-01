import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Music, Trash2, Upload, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadSong, deleteSong, listAllSongsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MyPiMusic" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const songsQ = useQuery({
    queryKey: ["admin", "songs"],
    queryFn: () => listAllSongsAdmin(),
    enabled: isAdmin,
  });

  const uploadMut = useMutation({
    mutationFn: async (fd: FormData) => uploadSong({ data: fd }),
    onSuccess: () => {
      setMessage("Song uploaded successfully.");
      setError(null);
      formRef.current?.reset();
      qc.invalidateQueries({ queryKey: ["admin", "songs"] });
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
    onError: (e: Error) => {
      setError(e.message || "Upload failed");
      setMessage(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteSong({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "songs"] });
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });

  if (!user) return null;
  if (!isAdmin) {
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    // Compute audio duration client-side.
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
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <section className="mb-6 rounded-2xl border border-white/10 bg-card/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Upload a song</h2>
        </div>

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
            {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadMut.isPending ? "Uploading…" : "Upload song"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">All songs ({songsQ.data?.length ?? 0})</h2>
        </div>
        {songsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (songsQ.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">No songs uploaded yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {songsQ.data!.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.artist} · {s.plays.toLocaleString()} plays
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${s.title}"? This cannot be undone.`)) {
                      deleteMut.mutate(s.id);
                    }
                  }}
                  disabled={deleteMut.isPending}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                  aria-label={`Delete ${s.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
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
