import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Request Account Deletion | M-Care" };

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/login" className="text-pink-700 underline">Back to M-Care</Link>
      <article className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Request account deletion</h1>
        <p className="mt-4">If you cannot use the M-Care app, email <a className="text-pink-700 underline" href="mailto:CLINIC_CONTACT_EMAIL">CLINIC_CONTACT_EMAIL</a> from the email address on your account and ask to delete your account. The clinic may ask you to verify your identity before acting.</p>
        <p className="mt-4">Deleting an account removes its login and direct contact details and cancels future appointments. Clinical records and audit history may be retained without direct identifiers for RETENTION_PERIOD where required by law or otherwise lawfully necessary.</p>
        <p className="mt-4">The clinic will confirm when the request is completed or explain any records it must retain.</p>
      </article>
    </main>
  );
}
