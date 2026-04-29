/**
 * BillingCancel — landing page when the user backs out of Safepay checkout.
 * Reassuring, no scolding; offers a retry.
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCcw } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />
      <main className="px-4 pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900/70"
        >
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Checkout cancelled
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No charge was made. You can resume your upgrade whenever you're ready —
            your account is unchanged.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
              <Link to="/pricing">
                <RefreshCcw className="h-4 w-4 mr-2" /> Try again
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
