import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import Navbar from "@/components/Navbar";

const TermsOfService = () => (
  <>
    <Navbar />
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-white pt-24 pb-16">
      <div className="container mx-auto max-w-3xl px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-violet-100 p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Terms of Service</h1>
              <p className="text-xs text-slate-400 mt-0.5">Last updated: April 12, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">1. Acceptance of Terms</h2>
              <p className="text-slate-600">
                By accessing or using <strong>PrepNest</strong> ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. PrepNest is a student-built platform and these terms are designed to be straightforward and fair.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">2. Description of Service</h2>
              <p className="text-slate-600">
                PrepNest is an AI-powered coaching platform that helps students prepare for USAT and HAT exams. The Service includes study materials, practice tests, an AI tutor, and related educational features. We offer both free and potentially premium features.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">3. User Accounts</h2>
              <p className="text-slate-600 mb-2">To access certain features, you must create an account using either:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Email and password</strong> — you are responsible for keeping your credentials secure.</li>
                <li><strong>Google OAuth</strong> — you authorize us to receive your basic profile information (name and email) from Google.</li>
              </ul>
              <p className="text-slate-600 mt-2">
                You must provide accurate information when creating your account. You are responsible for all activity that occurs under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">4. Acceptable Use</h2>
              <p className="text-slate-600 mb-2">When using PrepNest, you agree <strong>not</strong> to:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                <li>Attempt to hack, exploit, or disrupt the platform or its infrastructure.</li>
                <li>Upload malicious content, viruses, or harmful code.</li>
                <li>Impersonate other users or misrepresent your identity.</li>
                <li>Scrape, copy, or redistribute content from the platform without permission.</li>
                <li>Abuse, harass, or threaten other users of the Service.</li>
                <li>Use automated tools (bots, scrapers) to access the Service without our written consent.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">5. AI-Generated Content Disclaimer</h2>
              <p className="text-slate-600">
                PrepNest uses artificial intelligence to provide tutoring, explanations, and feedback. While we strive for accuracy, <strong>AI-generated content may contain errors or inaccuracies</strong>. It should be used as a study aid, not as a sole source of truth. Always cross-reference important information with official study materials and textbooks. We are not responsible for decisions made based on AI-generated content.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">6. Intellectual Property</h2>
              <p className="text-slate-600">
                All content, design, code, and materials on PrepNest are the property of PrepNest and its creators, unless otherwise stated. You may not reproduce, distribute, or create derivative works from our content without explicit permission. Content you create (such as notes) remains yours.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">7. Account Suspension &amp; Termination</h2>
              <p className="text-slate-600">
                We reserve the right to suspend or terminate your account at our discretion if you violate these Terms or engage in behavior that harms the platform or other users. We will make reasonable efforts to notify you, but we are not obligated to do so in cases of severe violations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">8. Service Availability</h2>
              <p className="text-slate-600">
                PrepNest is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis. We do our best to keep the Service running smoothly, but we do not guarantee uninterrupted or error-free operation. We may modify, suspend, or discontinue features at any time without prior notice. As a student-built project, we appreciate your patience as we improve.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">9. Limitation of Liability</h2>
              <p className="text-slate-600">
                To the maximum extent permitted by law, PrepNest and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. This includes, but is not limited to, loss of data, exam results, or any damages resulting from reliance on AI-generated content. Our total liability shall not exceed the amount you have paid us (if any) in the past 12 months.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">10. Third-Party Services</h2>
              <p className="text-slate-600">
                PrepNest integrates with third-party services including Google (for authentication) and Resend (for email delivery). Your use of these services is governed by their respective terms and privacy policies. We are not responsible for the practices of third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">11. Changes to These Terms</h2>
              <p className="text-slate-600">
                We may update these Terms of Service from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the Service after changes constitutes your acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">12. Contact Us</h2>
              <p className="text-slate-600">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:support@prepnest.com" className="text-violet-600 hover:text-violet-800 underline">support@prepnest.com</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  </>
);

export default TermsOfService;
