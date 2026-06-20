import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Music, FileText, AlertTriangle } from "lucide-react";
import logoAsset from "@/assets/mypimusic-logo.jpg.asset.json";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MyPiMusic" },
      { name: "description", content: "MyPiMusic Privacy Policy. Learn how we collect, use, and protect your data when you use our Pi Network music streaming platform." },
      { property: "og:title", content: "Privacy Policy — MyPiMusic" },
      { property: "og:description", content: "MyPiMusic Privacy Policy. Learn how we collect, use, and protect your data when you use our Pi Network music streaming platform." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Simple header for public pages */}
      <header className="border-b border-white/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="MyPiMusic" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-bold">
              My<span className="text-primary">Pi</span>Music
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to App
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient-gold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 20, 2026</p>
        </div>

        <div className="space-y-8 rounded-2xl border border-white/10 bg-card/40 p-6 sm:p-8">
          {/* Disclaimer */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Independent Third-Party App</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic is an <strong className="text-foreground">independent third-party application</strong> and is not affiliated with, endorsed by, or operated by Pi Network, Pi Core Team, or Stellar Development Foundation. We are a community-built platform that uses Pi Network authentication services. Pi Network trademarks, logos, and brand assets are the property of their respective owners.
            </p>
          </section>

          <hr className="border-white/10" />

          {/* 1. Introduction */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">1. Introduction</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and share information when you use our music streaming and promotion platform built for the Pi Network community.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="mb-3 text-lg font-bold">2. Information We Collect</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pi Network Authentication Data</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  When you sign in with Pi Network, we receive your Pi username and a unique user identifier (UID) from the Pi SDK. We do <strong className="text-foreground">not</strong> receive or store your Pi wallet passphrase, private keys, or payment authorization credentials. Authentication is handled directly by Pi Network's secure servers.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Profile Information</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  If you create an artist or user profile, you may voluntarily provide a display name, bio, profile picture, and social links. This information is public within the MyPiMusic platform.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Music Content</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Artists who upload music may submit audio files, cover artwork, track titles, lyrics, genre tags, and release metadata. By uploading, you represent that you have the rights to distribute this content.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Usage Data</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We collect anonymized playback statistics (e.g., play counts, skip rates, playlist creation) to improve recommendations and artist analytics. This data is not linked to your real-world identity outside your Pi username.
                </p>
              </div>
            </div>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="mb-3 text-lg font-bold">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>To authenticate your identity via Pi Network and secure your account.</li>
              <li>To personalize your music experience (playlists, recommendations, favorites).</li>
              <li>To enable artist profiles and music distribution within the platform.</li>
              <li>To provide playback analytics and insights to artists who upload content.</li>
              <li>To enforce our Terms of Service and protect against fraud or abuse.</li>
              <li>To communicate service updates, features, or critical security notices.</li>
            </ul>
          </section>

          {/* 4. Pi Network Authentication Privacy */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">4. Pi Network Authentication Privacy</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic uses the official Pi Network SDK to authenticate users. When you authorize MyPiMusic through Pi Browser:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Your Pi username and UID are shared with us to create and identify your account.</li>
              <li>We request the <em>payments</em> scope to prepare for future Pi-based transactions (subscriptions, tips, purchases). No payments are processed without your explicit confirmation.</li>
              <li>We do not see your Pi wallet balance, transaction history, or wallet address unless you explicitly authorize a payment.</li>
              <li>Pi Network's own Privacy Policy and Terms of Service govern your relationship with Pi Network. We encourage you to review them at <a href="https://minepi.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">minepi.com</a>.</li>
            </ul>
          </section>

          {/* 5. User-Uploaded Content */}
          <section>
            <h2 className="mb-3 text-lg font-bold">5. User-Uploaded Content</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Artists and users may upload music, artwork, profile images, and text to MyPiMusic. By uploading content:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>You grant MyPiMusic a non-exclusive, worldwide, royalty-free license to host, display, stream, and promote your content within the platform.</li>
              <li>You retain full ownership of your original content and may request removal at any time by contacting us.</li>
              <li>You warrant that you own or control all rights to the content you upload and that it does not infringe third-party intellectual property rights.</li>
              <li>We may remove content that violates copyright, our Terms of Service, or applicable law without prior notice.</li>
            </ul>
          </section>

          {/* 6. Copyright and DMCA */}
          <section>
            <h2 className="mb-3 text-lg font-bold">6. Copyright and DMCA Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic respects intellectual property rights and expects all users to do the same. We comply with the Digital Millennium Copyright Act (DMCA) and similar international copyright laws.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>If you believe your copyrighted work has been uploaded without authorization, please submit a written DMCA notice including: identification of the copyrighted work, the location of the infringing material on our platform, your contact information, a good-faith belief statement, and a statement under penalty of perjury that the information is accurate.</li>
              <li>Repeat infringers will have their accounts terminated.</li>
              <li>MyPiMusic reserves the right to remove any content suspected of copyright infringement without prior notice.</li>
            </ul>
          </section>

          {/* 7. Data Sharing */}
          <section>
            <h2 className="mb-3 text-lg font-bold">7. Data Sharing and Third Parties</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We do not sell your personal data to advertisers or data brokers. We may share limited data with:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">Pi Network:</strong> Only for authentication and payment processing purposes, as governed by your Pi Network consent.</li>
              <li><strong className="text-foreground">Cloud infrastructure providers:</strong> For hosting, storage, and content delivery (e.g., CDN services) under strict data-processing agreements.</li>
              <li><strong className="text-foreground">Legal authorities:</strong> Only when required by valid legal process, court order, or to protect the safety and rights of our users.</li>
            </ul>
          </section>

          {/* 8. Data Retention */}
          <section>
            <h2 className="mb-3 text-lg font-bold">8. Data Retention</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We retain your account data and uploaded content for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time. Some data may be retained in anonymized or aggregated form for analytics after account deletion.
            </p>
          </section>

          {/* 9. Security */}
          <section>
            <h2 className="mb-3 text-lg font-bold">9. Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We implement industry-standard security measures including HTTPS encryption, secure authentication tokens, access controls, and regular security reviews. However, no online service is completely secure, and we cannot guarantee absolute protection against all security risks.
            </p>
          </section>

          {/* 10. Children's Privacy */}
          <section>
            <h2 className="mb-3 text-lg font-bold">10. Children's Privacy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic is not intended for users under the age of 13 (or the applicable minimum age in your jurisdiction). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="mb-3 text-lg font-bold">11. Changes to This Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy periodically. Material changes will be communicated through the app or via Pi Network channels. Continued use of MyPiMusic after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="mb-3 text-lg font-bold">12. Contact Us</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have questions, concerns, or data requests regarding this Privacy Policy, please reach out through the Pi Network community channels or contact us within the MyPiMusic platform.
            </p>
          </section>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By using MyPiMusic, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
