import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Mic2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getArtistStatus, submitArtistApplication } from "@/lib/artist.functions";

export const Route = createFileRoute("/_authenticated/become-artist")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Menjadi Artis — MyPiMusic" },
      {
        name: "description",
        content: "Premium members can apply to become a verified MyPiMusic artist.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BecomeArtistPage,
});

const inputCls =
  "w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60";

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card/60 p-4 sm:p-6">{children}</section>
  );
}

function BecomeArtistPage() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["artist", "status"], queryFn: () => getArtistStatus() });
  const [reapply, setReapply] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = useMutation({
    mutationFn: (fd: FormData) => submitArtistApplication({ data: fd }),
    onSuccess: () => {
      toast.success("Permohonan terkirim! Admin akan meninjau permohonan Anda.");
      formRef.current?.reset();
      setReapply(false);
      qc.invalidateQueries({ queryKey: ["artist", "status"] });
    },
    onError: (e: Error) => toast.error(e.message || "Gagal mengirim permohonan"),
  });

  if (status.isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (status.isError) {
    return (
      <Section>
        <p className="text-sm text-destructive">Gagal memuat status: {(status.error as Error).message}</p>
      </Section>
    );
  }

  const data = status.data!;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-purple">
        <div className="flex items-center gap-3">
          <Mic2 className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-extrabold">🎤 Menjadi Artis</h1>
            <p className="text-xs opacity-85">
              Premium Member → Permohonan Artis → Review Admin → Artis Disetujui
            </p>
          </div>
        </div>
      </header>

      {/* Already an approved artist */}
      {data.profile && (
        <Section>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-bold">Selamat! Permohonan Anda sebagai artis telah disetujui.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Anda tampil sebagai <strong>{data.profile.artist_name}</strong>
                {data.profile.pioneer_artist && (
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    🎵 Pioneer Artist
                  </span>
                )}
              </p>
              {data.profile.status === "suspended" && (
                <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  Akun artis Anda sedang ditangguhkan. Hubungi Admin.
                </p>
              )}
              <Link
                to="/artist-dashboard"
                className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Buka Artist Dashboard
              </Link>
            </div>
          </div>
        </Section>
      )}

      {/* Not premium */}
      {!data.profile && !data.isPremium && (
        <Section>
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-bold">Fitur menjadi artis tersedia untuk member Premium.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade ke Premium untuk dapat mengirimkan permohonan artis. Premium tidak otomatis
                menjadikan Anda artis — permohonan tetap ditinjau Admin.
              </p>
              <Link
                to="/membership"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Crown className="h-4 w-4" /> Lihat Membership
              </Link>
            </div>
          </div>
        </Section>
      )}

      {/* Pending */}
      {!data.profile && data.application?.status === "pending" && (
        <Section>
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-bold">Permohonan Anda sedang diperiksa oleh Admin.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dikirim {new Date(data.application.created_at).toLocaleString()} sebagai{" "}
                <strong>{data.application.artist_name}</strong>.
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Rejected */}
      {!data.profile && data.application?.status === "rejected" && !reapply && (
        <Section>
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-bold">Permohonan Anda ditolak.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alasan: {data.application.rejection_reason || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Tanggal:{" "}
                {new Date(data.application.reviewed_at ?? data.application.created_at).toLocaleString()}
              </p>
              {data.isPremium && (
                <button
                  onClick={() => setReapply(true)}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Ajukan Lagi
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Application form */}
      {!data.profile &&
        data.isPremium &&
        (!data.application || (data.application.status === "rejected" && reapply)) && (
          <Section>
            <h2 className="text-base font-bold">Formulir Permohonan Artis</h2>
            <form
              ref={formRef}
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("guidelinesAccepted", fd.get("guidelinesAccepted") ? "true" : "false");
                fd.set("copyrightAccepted", fd.get("copyrightAccepted") ? "true" : "false");
                if (fd.get("copyrightAccepted") !== "true") {
                  toast.error("Anda harus menyetujui pernyataan keaslian karya.");
                  return;
                }
                if (fd.get("guidelinesAccepted") !== "true") {
                  toast.error("Anda harus menyetujui Panduan Artis.");
                  return;
                }
                submit.mutate(fd);
              }}
            >
              <label className="text-sm">
                Nama Artis *
                <input name="artistName" required maxLength={120} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm">
                Nama Lengkap *
                <input name="fullName" required maxLength={120} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm">
                Genre Musik *
                <input name="genre" required maxLength={60} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm">
                Kota / Negara *
                <input name="location" required maxLength={120} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm sm:col-span-2">
                Bio Artis *
                <textarea name="bio" required rows={4} maxLength={2000} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm sm:col-span-2">
                Deskripsi singkat
                <input name="description" maxLength={500} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm">
                YouTube URL
                <input name="youtube" className={`mt-1 ${inputCls}`} placeholder="https://youtube.com/@..." />
              </label>
              <label className="text-sm">
                Instagram URL
                <input name="instagram" className={`mt-1 ${inputCls}`} placeholder="https://instagram.com/..." />
              </label>
              <label className="text-sm">
                TikTok URL
                <input name="tiktok" className={`mt-1 ${inputCls}`} placeholder="https://tiktok.com/@..." />
              </label>
              <label className="text-sm">
                Spotify / platform musik lain
                <input name="musicPlatform" className={`mt-1 ${inputCls}`} placeholder="https://open.spotify.com/..." />
              </label>
              <label className="text-sm">
                Foto / Avatar Artis (maks 5MB)
                <input name="avatar" type="file" accept="image/*" className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-sm">
                Lagu / Demo Orisinal * (maks 30MB)
                <input name="demo" type="file" accept="audio/*" required className={`mt-1 ${inputCls}`} />
              </label>

              <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-500">
                  <AlertTriangle className="h-4 w-4" /> ⚠️ PERNYATAAN KEASLIAN KARYA
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Lagu yang diunggah ke MyPiMusic harus merupakan karya orisinal milik Anda sendiri
                  atau karya yang Anda memiliki hak dan izin yang sah untuk mendistribusikannya.
                  MyPiMusic tidak menerima lagu cover, remix, re-upload, atau karya milik pihak lain
                  tanpa hak/izin yang sesuai.
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input type="checkbox" name="copyrightAccepted" className="mt-0.5" />
                  <span>
                    Saya menyatakan bahwa karya yang saya unggah adalah karya orisinal dan saya
                    bertanggung jawab atas keabsahan hak atas karya tersebut.
                  </span>
                </label>
                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input type="checkbox" name="guidelinesAccepted" className="mt-0.5" />
                  <span>Saya menyetujui Panduan Artis MyPiMusic.</span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submit.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
                >
                  {submit.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Submit Application
                </button>
                {submit.isError && (
                  <p className="mt-2 text-xs text-destructive">{(submit.error as Error).message}</p>
                )}
              </div>
            </form>
          </Section>
        )}
    </div>
  );
}
