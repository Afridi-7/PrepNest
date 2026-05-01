import { Link } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const OwnershipStatement = () => (
  <>
    <Navbar />
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-white pt-24 pb-16">
      <div className="container mx-auto max-w-3xl px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Ownership Statement</h1>
              <p className="text-xs text-slate-400 mt-0.5">Last updated: May 1, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">1. Platform Identity</h2>
              <p className="text-slate-600">
                <strong>PrepNest AI</strong> (operating under the domain <a href="https://prepnestai.app" className="text-blue-600 hover:text-blue-800 underline">prepnestai.app</a>) is an AI-powered educational technology platform designed to assist Pakistani students in preparing for USAT (Undergraduate Scholastic Assessment Test) and HAT (Higher Education Assessment Test) examinations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">2. Ownership</h2>
              <p className="text-slate-600">
                PrepNest AI is independently owned and operated. The platform, its codebase, content, branding, and all associated intellectual property are the exclusive property of the founders and operators of PrepNest AI. The platform is not affiliated with, endorsed by, or operated under any external corporation or institution.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">3. Business Nature</h2>
              <p className="text-slate-600">
                PrepNest AI is a digital-only educational platform. We do not operate any physical retail locations or stores. All services — including study materials, practice tests, AI tutoring, and mock examinations — are delivered exclusively through our website at{" "}
                <a href="https://prepnestai.app" className="text-blue-600 hover:text-blue-800 underline">prepnestai.app</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">4. Country of Operation</h2>
              <p className="text-slate-600">
                PrepNest AI operates from <strong>Pakistan</strong>. Our primary audience and user base consists of Pakistani students, and our content is tailored to the Pakistani higher education entrance examination system.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">5. Payment Processing</h2>
              <p className="text-slate-600">
                Payments on PrepNest AI are processed securely through <strong>Safepay</strong>, a licensed payment service provider operating under the regulations of the State Bank of Pakistan. PrepNest AI does not store or process any raw payment card data. All transactions are handled by Safepay's secure infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">6. Intellectual Property</h2>
              <p className="text-slate-600">
                All content available on PrepNest AI — including but not limited to question banks, explanations, study guides, AI-generated tutoring content, UI/UX design, and source code — is the property of PrepNest AI. Unauthorized reproduction, distribution, or commercial use of any content is strictly prohibited.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">7. Responsibility &amp; Accountability</h2>
              <p className="text-slate-600">
                The owners of PrepNest AI are fully responsible for the operation of this website, the accuracy of the information presented, the services offered, and compliance with applicable laws and payment regulations. We are committed to providing a safe, transparent, and fair experience for all our users.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">8. Contact Information</h2>
              <p className="text-slate-600 mb-1">For any questions, concerns, or legal inquiries regarding the ownership or operation of PrepNest AI, please contact us:</p>
              <ul className="list-none pl-0 text-slate-600 space-y-1">
                <li><strong>Website:</strong>{" "}<a href="https://prepnestai.app" className="text-blue-600 hover:text-blue-800 underline">https://prepnestai.app</a></li>
                <li><strong>Email:</strong>{" "}<a href="mailto:support@prepnest.com" className="text-blue-600 hover:text-blue-800 underline">support@prepnest.com</a></li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  </>
);

export default OwnershipStatement;
