import { Link } from "react-router-dom";
import { Film } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">ShotLogic</span>
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: April 18, 2026</p>

        <div className="space-y-10 text-white/70 leading-relaxed">
          <section>
            <p>
              This Privacy Policy explains what information ShotLogic ("we", "our", "us") collects
              when you use the ShotLogic application at shotlogic.studio, how we use it, and the
              choices you have. If you have any questions, email us at{" "}
              <a href="mailto:support@shotlogic.studio" className="text-[#E50914] hover:underline">
                support@shotlogic.studio
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Information we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Account information.</strong> When you sign up, our
                authentication provider Clerk collects your email address and name. We use this to
                identify your account and send product notifications.
              </li>
              <li>
                <strong className="text-white">Screenplay content.</strong> Any screenplay files
                you upload (PDF, Final Draft, or text) and the scene analyses, shot lists, and
                related notes generated from them.
              </li>
              <li>
                <strong className="text-white">Project metadata.</strong> Project names, creation
                and modification timestamps, and the visual style or character notes you add.
              </li>
              <li>
                <strong className="text-white">Payment information.</strong> When you purchase
                credits, Stripe processes the payment. We receive a record of the transaction
                (amount, date, credits granted) but we do not receive or store your card number.
              </li>
              <li>
                <strong className="text-white">Usage logs.</strong> Routine server logs (IP, user
                agent, request paths, timestamps) for operating and securing the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How your screenplay is processed</h2>
            <p className="mb-3">
              To generate scene analyses and shot lists, the text of your screenplay is sent to
              Anthropic's Claude API. Under Anthropic's commercial API terms, content submitted by
              API customers is <strong className="text-white">not used to train Anthropic's
              models</strong>.
            </p>
            <p>
              Your screenplays and generated analyses are stored in our database so that you can
              return to your projects, revise shot lists, and export them. We do not share your
              screenplay content with anyone outside the processing described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Third-party services</h2>
            <p className="mb-3">
              ShotLogic relies on the following third-party services. Each has its own privacy
              policy that governs how it handles data passed through it:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Clerk</strong> — user authentication and account management.</li>
              <li><strong className="text-white">MongoDB Atlas</strong> — encrypted storage for your projects, analyses, and account records.</li>
              <li><strong className="text-white">Stripe</strong> — payment processing for credit purchases.</li>
              <li><strong className="text-white">Anthropic</strong> — AI analysis of screenplay text via the Claude API.</li>
              <li><strong className="text-white">Resend</strong> — transactional email (e.g. signup notifications).</li>
              <li><strong className="text-white">Railway</strong> — hosting and deployment infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data retention</h2>
            <p>
              We retain your projects and analyses for as long as your account is active, or until
              you delete them individually. If you close your account, we will delete your project
              data within 30 days. Aggregated, non-identifying usage statistics and payment records
              required for tax and accounting may be retained longer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your rights and choices</h2>
            <p className="mb-3">
              You own the content you upload to ShotLogic. You can:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Delete individual projects at any time from your dashboard.</li>
              <li>Request a copy of the data we hold about you.</li>
              <li>Request deletion of your account and all associated data by emailing{" "}
                <a href="mailto:support@shotlogic.studio" className="text-[#E50914] hover:underline">support@shotlogic.studio</a>.
              </li>
              <li>Request correction of inaccurate account information.</li>
            </ul>
            <p className="mt-3">We aim to respond to verified requests within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Cookies</h2>
            <p>
              ShotLogic uses session cookies set by Clerk to keep you signed in. We do not use
              advertising or third-party tracking cookies. You can clear these cookies at any time
              through your browser, though doing so will sign you out.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Updates to this policy</h2>
            <p>
              We may update this policy from time to time. If we make material changes that affect
              how your data is used, we will notify you by email before the change takes effect.
              The "Last updated" date above reflects the most recent version.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions, data requests, and privacy concerns:{" "}
              <a href="mailto:support@shotlogic.studio" className="text-[#E50914] hover:underline">
                support@shotlogic.studio
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-white/5 text-center text-white/30 text-sm">
        <Link to="/" className="hover:text-white/60 transition-colors">© 2026 ShotLogic</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
        <span className="mx-2">·</span>
        <a href="mailto:support@shotlogic.studio" className="hover:text-white/60 transition-colors">Contact</a>
      </footer>
    </div>
  );
}
