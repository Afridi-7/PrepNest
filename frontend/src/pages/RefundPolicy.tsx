import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import Navbar from "@/components/Navbar";

const RefundPolicy = () => (
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
              <RefreshCcw className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Cancellation &amp; Refund Policy</h1>
              <p className="text-xs text-slate-400 mt-0.5">Last updated: May 1, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">1. Overview</h2>
              <p className="text-slate-600">
                PrepNest AI offers digital subscription services to help students prepare for USAT and HAT exams. Because our services are delivered digitally and access is granted immediately upon payment, our refund policy reflects the nature of digital goods.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">2. Subscription Plans</h2>
              <p className="text-slate-600 mb-2">PrepNest AI currently offers the following subscription:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li><strong>Pro Plan:</strong> A one-time payment that grants access to premium features including unlimited AI tutoring, all practice sets, mock tests, and study analytics.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">3. Cancellation Policy</h2>
              <p className="text-slate-600">
                Since PrepNest Pro is a one-time purchase (not a recurring subscription), there is no recurring charge to cancel. Access to Pro features remains active for the duration of your purchased plan period. You may stop using the service at any time without any further obligation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">4. Refund Policy</h2>
              <p className="text-slate-600 mb-2">
                We understand that circumstances vary. Our refund policy is as follows:
              </p>
              <ul className="list-disc pl-5 text-slate-600 space-y-2">
                <li>
                  <strong>7-day refund window:</strong> If you are not satisfied with your purchase, you may request a full refund within <strong>7 days</strong> of your payment date, provided you have not consumed a significant portion of the premium content (e.g., completed more than 20% of mock tests or generated more than 50 AI tutor responses).
                </li>
                <li>
                  <strong>Technical issues:</strong> If you were charged but did not receive Pro access due to a technical error, you are entitled to a full refund or immediate access correction — whichever you prefer. Please contact us promptly.
                </li>
                <li>
                  <strong>After 7 days:</strong> Refund requests made after 7 days of purchase will be evaluated on a case-by-case basis. We reserve the right to decline refunds for purchases where substantial service has already been delivered.
                </li>
                <li>
                  <strong>Duplicate payments:</strong> If you were accidentally charged more than once for the same plan, the duplicate charge will be refunded in full without any questions.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">5. Non-Refundable Circumstances</h2>
              <p className="text-slate-600 mb-2">Refunds will <strong>not</strong> be issued in the following situations:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li>You changed your mind after 7 days of purchase and have used the service.</li>
                <li>Your account was suspended or terminated due to a violation of our Terms of Service.</li>
                <li>You misused the platform or violated our acceptable use policy.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">6. No Physical Returns</h2>
              <p className="text-slate-600">
                PrepNest AI is an entirely digital platform. We do not sell or ship any physical goods. There are no physical items to return.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">7. How to Request a Refund</h2>
              <p className="text-slate-600 mb-2">To request a refund, please email us at:</p>
              <p className="text-slate-700 font-medium">
                <a href="mailto:support@prepnest.com" className="text-blue-600 hover:text-blue-800 underline">support@prepnest.com</a>
              </p>
              <p className="text-slate-600 mt-2">Please include in your email:</p>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                <li>Your registered email address.</li>
                <li>The date of your payment.</li>
                <li>Your payment reference or transaction ID (if available).</li>
                <li>A brief reason for your refund request.</li>
              </ul>
              <p className="text-slate-600 mt-2">
                We will respond to all refund requests within <strong>3–5 business days</strong>. Approved refunds will be processed back to the original payment method within 7–10 business days, subject to your bank's processing times.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-2">8. Contact Us</h2>
              <p className="text-slate-600">
                If you have any questions about this policy, please reach out to us at{" "}
                <a href="mailto:support@prepnest.com" className="text-blue-600 hover:text-blue-800 underline">support@prepnest.com</a>. We are happy to help.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  </>
);

export default RefundPolicy;
