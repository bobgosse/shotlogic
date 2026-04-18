import { Link } from "react-router-dom";
import { Film } from "lucide-react";

export default function Terms() {
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
        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: April 18, 2026</p>

        <div className="space-y-10 text-white/70 leading-relaxed">
          <section>
            <p>
              These Terms of Service ("Terms") govern your access to and use of ShotLogic, operated
              from North Carolina, USA. By creating an account or using the service, you agree to
              these Terms. If you do not agree, please do not use ShotLogic.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your account</h2>
            <p>
              You are responsible for keeping your login credentials confidential and for all
              activity that occurs under your account. Notify us promptly at{" "}
              <a href="mailto:support@shotlogic.studio" className="text-[#E50914] hover:underline">
                support@shotlogic.studio
              </a>{" "}
              if you believe your account has been compromised. One account per person; automated
              or shared accounts are not permitted without written approval.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Acceptable use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload content you do not own or have the right to submit for analysis.</li>
              <li>Scrape, crawl, or bulk-extract data from ShotLogic.</li>
              <li>Resell or redistribute AI-generated outputs as-is as your own service or product.</li>
              <li>Attempt to bypass authentication, rate limits, or access controls.</li>
              <li>Reverse-engineer, probe, or test the vulnerability of the service without written permission.</li>
              <li>Use ShotLogic to generate content that is illegal, defamatory, or infringing on the rights of others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your content</h2>
            <p>
              You retain full ownership of the screenplays you upload and the analyses, shot lists,
              and other outputs generated from them. You grant ShotLogic a limited license to
              store, process, and display your content solely to provide the service to you. We
              claim no rights to your creative work.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Service availability and accuracy</h2>
            <p className="mb-3">
              ShotLogic is provided on an "as is" and "as available" basis. We do not guarantee
              uninterrupted availability, and scheduled or emergency maintenance may occur without
              prior notice.
            </p>
            <p>
              AI-generated analyses are tools to assist your creative and production judgment —
              they are not a substitute for it. Treat scene breakdowns, shot lists, budget flags,
              and directing notes as starting points to evaluate, not authoritative advice. We do
              not warrant that outputs are accurate, complete, or fit for any particular production.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Credits and payments</h2>
            <p className="mb-3">
              ShotLogic uses a prepaid credit system. One credit is consumed per scene analysis.
              Purchased credits are non-refundable except where required by law, including rare
              cases of confirmed service error (contact support if you believe you were
              incorrectly charged).
            </p>
            <p>
              Credit package prices are listed on the purchase page and may change from time to
              time. Price changes do not retroactively affect credits you have already purchased.
              Promotional or bonus credits may carry expiration dates and conditions communicated
              at the time they are granted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Termination</h2>
            <p>
              You may close your account at any time by emailing support. We reserve the right to
              suspend or terminate accounts that violate these Terms, engage in fraud, or place
              unusual load on the service. Where practical, we will provide notice before
              termination. Termination does not entitle you to a refund of unused credits unless
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Disclaimers and limitation of liability</h2>
            <p className="mb-3">
              To the fullest extent permitted by law, ShotLogic disclaims all warranties, express
              or implied, including merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
            <p>
              In no event will our total liability to you for any claim arising out of or relating
              to ShotLogic exceed the amount you paid us in the 12 months preceding the claim, or
              one hundred US dollars (USD $100), whichever is greater. We are not liable for lost
              profits, lost revenue, lost data, or indirect, incidental, consequential, or
              punitive damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Governing law</h2>
            <p>
              These Terms are governed by the laws of the State of North Carolina, USA, without
              regard to its conflict-of-laws principles. Any dispute arising out of or relating to
              these Terms or the service will be brought exclusively in the state or federal
              courts located in North Carolina, and you consent to their jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will
              notify you by email or via an in-app notice before the changes take effect. Your
              continued use of ShotLogic after the effective date constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about these Terms:{" "}
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
