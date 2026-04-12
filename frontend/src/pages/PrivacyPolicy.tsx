import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import Navbar from "@/components/Navbar";

const PrivacyPolicy = () => (
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
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Privacy Policy</h1>
              <p className="text-xs text-slate-400 mt-0.5">Last updated: April 12, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">1. Introduction</h2>
              <p className="text-slate-600">
                Welcome to <strong>PrepNest</strong>. We are a student-built AI coaching platform designed to help students prepare for USAT and HAT exams. We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains what data we collect, why we collect it, and how we handle it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">2. Information We Collect</h2>
              <p className="text-slate-600 mb-2">When you use PrepNest, we may collect the following information:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Account information:</strong> Your name, email address, and password (if you register with email/password).</li>
                <li><strong>Google profile information:</strong> If you sign in with Google OAuth, we receive your name, email address, and Google account ID from Google. We do <em>not</em> access your contacts, calendar, or any other Google data.</li>
                <li><strong>Usage data:</strong> Pages you visit, features you use, and interactions with the AI tutor — to improve your learning experience.</li>
                <li><strong>Device information:</strong> Browser type and general device info sent automatically with web requests.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">3. How We Use Your Data</h2>
              <p className="text-slate-600 mb-2">We use the information we collect to:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Authenticate you</strong> — verify your identity when you log in via email/password or Google OAuth.</li>
                <li><strong>Provide our services</strong> — deliver AI tutoring, practice tests, and personalized study content.</li>
                <li><strong>Improve the platform</strong> — understand how features are used so we can make PrepNest better.</li>
                <li><strong>Communicate with you</strong> — send verification emails or important service updates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">4. How We Store Your Data</h2>
              <p className="text-slate-600">
                Your data is stored in a secure <strong>PostgreSQL database</strong> hosted on trusted cloud infrastructure. Passwords are hashed using industry-standard algorithms (bcrypt) and are never stored in plain text. We use HTTPS encryption for all data transmitted between your browser and our servers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">5. Data Sharing</h2>
              <p className="text-slate-600 mb-2">
                We do <strong>not</strong> sell, rent, or trade your personal data to any third party. We only share data with:
              </p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Authentication providers</strong> — Google (for OAuth login) receives only the data necessary to authenticate you.</li>
                <li><strong>Email delivery services</strong> — We use Resend to send verification and transactional emails. Only your email address is shared for this purpose.</li>
                <li><strong>Hosting providers</strong> — Our cloud infrastructure providers store data on our behalf under strict security practices.</li>
              </ul>
              <p className="text-slate-600 mt-2">We may disclose information if required by law or to protect the safety of our users.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">6. Google OAuth &amp; Limited Use Disclosure</h2>
              <p className="text-slate-600">
                PrepNest uses Google OAuth 2.0 to let you sign in with your Google account. Our use and transfer of information received from Google APIs adheres to the{" "}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 underline">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We only request access to your basic profile information (name and email) and do not request access to any other Google services or data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">7. Your Rights</h2>
              <p className="text-slate-600 mb-2">You have the right to:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Access your data</strong> — request a copy of the personal information we hold about you.</li>
                <li><strong>Update your data</strong> — correct any inaccurate information in your profile.</li>
                <li><strong>Delete your data</strong> — request that we permanently delete your account and all associated data.</li>
              </ul>
              <p className="text-slate-600 mt-2">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:support@prepnest.com" className="text-violet-600 hover:text-violet-800 underline">support@prepnest.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">8. Cookies</h2>
              <p className="text-slate-600">
                We use browser local storage to save your session token and chat history for convenience. We do not use third-party tracking cookies or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">9. Children's Privacy</h2>
              <p className="text-slate-600">
                PrepNest is intended for students preparing for university entrance exams. We do not knowingly collect data from children under 13. If you believe a child under 13 has provided us with personal data, please contact us and we will delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">10. Changes to This Policy</h2>
              <p className="text-slate-600">
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last updated" date. We encourage you to review this page periodically.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">11. Contact Us</h2>
              <p className="text-slate-600">
                If you have any questions about this Privacy Policy, please reach out to us at{" "}
                <a href="mailto:support@prepnest.com" className="text-violet-600 hover:text-violet-800 underline">support@prepnest.com</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  </>
);

export default PrivacyPolicy;
