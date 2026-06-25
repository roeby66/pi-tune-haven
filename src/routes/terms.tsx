import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Gavel, Music, Scale, AlertTriangle } from "lucide-react";
import logoAsset from "@/assets/mypimusic-logo.jpg.asset.json";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MyPiMusic" },
      { name: "description", content: "MyPiMusic Terms of Service. Read the rules and guidelines for using our Pi Network music streaming platform." },
      { property: "og:title", content: "Terms of Service — MyPiMusic" },
      { property: "og:description", content: "MyPiMusic Terms of Service. Read the rules and guidelines for using our Pi Network music streaming platform." },
      { property: "og:url", content: "https://pi-tune-haven.lovable.app/terms" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pi-tune-haven.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
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
            <Gavel className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient-gold">Terms of Service</h1>
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
              MyPiMusic is an <strong className="text-foreground">independent third-party application</strong> built by the Pi Network community. We are not affiliated with, endorsed by, sponsored by, or operated by Pi Network, Pi Core Team, or any of their subsidiaries or partners. Use of Pi Network authentication and services is subject to Pi Network's own Terms of Service and Privacy Policy.
            </p>
          </section>

          <hr className="border-white/10" />

          {/* 1. Acceptance */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">1. Acceptance of Terms</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By accessing or using MyPiMusic, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you must not use the platform. These terms apply to all visitors, users, artists, and others who access or use MyPiMusic.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="mb-3 text-lg font-bold">2. Eligibility</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You must have a valid Pi Network account to use most features of MyPiMusic. By using the platform, you represent that you are at least 13 years old (or the minimum age of digital consent in your jurisdiction) and that you have the legal capacity to enter into these terms. If you are using MyPiMusic on behalf of an organization, you represent that you have authority to bind that organization.
            </p>
          </section>

          {/* 3. Pi Network Authentication */}
          <section>
            <h2 className="mb-3 text-lg font-bold">3. Pi Network Authentication</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic uses Pi Network's official SDK for user authentication. When you sign in:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>You authorize us to access your Pi username and UID for account creation and identification purposes.</li>
              <li>You may be asked to grant payment permissions for future Pi-based transactions. These are optional and require separate confirmation for each transaction.</li>
              <li>You are responsible for maintaining the security of your Pi Network account. MyPiMusic cannot recover your Pi wallet or reset your Pi credentials.</li>
              <li>We reserve the right to suspend or terminate accounts that appear to be fraudulent, duplicated, or otherwise in violation of Pi Network's policies.</li>
            </ul>
          </section>

          {/* 4. User-Generated Content */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">4. User-Generated Content</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic allows artists and users to upload music, artwork, text, and other materials ("Content"). You retain ownership of Content you create and upload. By uploading Content, you grant MyPiMusic a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, and display that Content within the platform for the purpose of operating and promoting the service.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You represent and warrant that:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>You own or have obtained all necessary rights, licenses, consents, and permissions to upload and share the Content.</li>
              <li>Your Content does not violate any third-party intellectual property rights, privacy rights, or publicity rights.</li>
              <li>Your Content does not contain malware, viruses, or any code designed to harm or disrupt systems.</li>
              <li>Your Content does not promote illegal activity, hate speech, harassment, violence, or sexually explicit material.</li>
            </ul>
          </section>

          {/* 5. Copyright and Intellectual Property */}
          <section>
            <h2 className="mb-3 text-lg font-bold">5. Copyright and Intellectual Property</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              All Content uploaded to MyPiMusic must comply with applicable copyright laws. You may not upload music, artwork, or other materials that you do not have the right to distribute.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>If you are an independent artist, you may upload your own original music and retain full ownership.</li>
              <li>If you upload cover songs, remixes, or samples, you are responsible for obtaining all necessary mechanical licenses, synchronization licenses, and sample clearances.</li>
              <li>MyPiMusic will respond to valid DMCA takedown notices and may remove infringing Content without notice.</li>
              <li>Repeat copyright infringers will have their accounts permanently terminated.</li>
              <li>If you believe your Content was wrongly removed, you may submit a counter-notification with sufficient detail for us to evaluate your claim.</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              MyPiMusic's name, logo, brand assets, and platform software are the property of MyPiMusic's creators and are protected by copyright and trademark law. You may not use our brand assets without prior written permission.
            </p>
          </section>

          {/* 6. Pi Payments and Transactions */}
          <section>
            <h2 className="mb-3 text-lg font-bold">6. Pi Payments and Transactions</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic may support Pi-based transactions for artist subscriptions, music purchases, tipping, and promotions. All Pi payments are processed through Pi Network's infrastructure:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Pi Network handles all payment authorization, settlement, and blockchain recording.</li>
              <li>MyPiMusic does not hold, custody, or directly transfer Pi coins. We only initiate payment requests through Pi Network's approved APIs.</li>
              <li>Refunds and disputes are handled according to Pi Network's policies and the specific terms of each transaction.</li>
              <li>MyPiMusic is not responsible for Pi Network blockchain delays, network congestion, or changes to Pi Network's protocol that affect transactions.</li>
            </ul>
          </section>

          {/* 7. Prohibited Conduct */}
          <section>
            <h2 className="mb-3 text-lg font-bold">7. Prohibited Conduct</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You agree not to:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Use MyPiMusic for any illegal purpose or in violation of any local, national, or international law.</li>
              <li>Attempt to gain unauthorized access to any part of the platform, other users' accounts, or our backend systems.</li>
              <li>Use bots, scrapers, or automated systems to access or collect data from MyPiMusic without permission.</li>
              <li>Impersonate another user, artist, or Pi Network entity.</li>
              <li>Manipulate play counts, ratings, or analytics data through artificial means.</li>
              <li>Distribute spam, phishing links, or unsolicited promotional content.</li>
              <li>Upload content that contains hate speech, threats, harassment, or explicit violence.</li>
            </ul>
          </section>

          {/* 8. Termination */}
          <section>
            <h2 className="mb-3 text-lg font-bold">8. Termination</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right to suspend or terminate your access to MyPiMusic at any time, with or without cause, and with or without notice, for conduct that we believe violates these Terms or is harmful to other users, the platform, or third parties. Upon termination, your right to use MyPiMusic will immediately cease.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section>
            <h2 className="mb-3 text-lg font-bold">9. Disclaimers</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              MyPiMusic is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the platform will be uninterrupted, secure, or error-free. We are not responsible for:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Content uploaded by users or artists, including its accuracy, legality, or quality.</li>
              <li>Loss of data, account access, or Pi tokens due to user error, phishing, or security breaches outside our control.</li>
              <li>Changes to Pi Network's protocol, API, or availability that affect MyPiMusic functionality.</li>
              <li>Third-party services integrated with MyPiMusic (e.g., content delivery networks, storage providers).</li>
            </ul>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="mb-3 text-lg font-bold">10. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To the maximum extent permitted by law, MyPiMusic and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or related to your use of or inability to use the platform, even if advised of the possibility of such damages.
            </p>
          </section>

          {/* 11. Indemnification */}
          <section>
            <h2 className="mb-3 text-lg font-bold">11. Indemnification</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You agree to indemnify, defend, and hold harmless MyPiMusic, its creators, and affiliates from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to your use of the platform, your Content, or your violation of these Terms.
            </p>
          </section>

          {/* 12. Governing Law */}
          <section>
            <h2 className="mb-3 text-lg font-bold">12. Governing Law</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction where MyPiMusic's primary operators are located, without regard to conflict of law principles. Disputes shall be resolved through good-faith negotiation. If unresolved, disputes may be submitted to binding arbitration or the competent courts of that jurisdiction.
            </p>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 className="mb-3 text-lg font-bold">13. Changes to These Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may modify these Terms at any time. Material changes will be communicated through the app or Pi Network community channels. Your continued use of MyPiMusic after changes constitutes acceptance of the revised Terms. It is your responsibility to review these Terms periodically.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="mb-3 text-lg font-bold">14. Contact Us</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For questions, concerns, or legal notices related to these Terms of Service, please contact us through the MyPiMusic platform or the Pi Network community channels where we are active.
            </p>
          </section>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By using MyPiMusic, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </main>
    </div>
  );
}
