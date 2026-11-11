import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";

export const metadata: Metadata = { title: "Request Account Deletion | M-Care" };

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-4 sm:px-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Request account deletion</h1>
          <p className="mt-5 text-base leading-7 text-gray-700">If you cannot use the M-Care app, contact the clinic through its official channels from the email address on your account and request deletion. The clinic may ask you to verify your identity before acting.</p>
          <p className="mt-4 text-base leading-7 text-gray-700">Deleting an account removes its login and direct contact details and cancels future appointments. Clinical records and audit history may be retained without direct identifiers under the clinic’s approved retention schedule where required by law or otherwise lawfully necessary.</p>
          <p className="mt-4 text-base leading-7 text-gray-700">The clinic will confirm when the request is completed or explain any records it must retain.</p>
        </article>
      </main>
    </div>
  );
}
