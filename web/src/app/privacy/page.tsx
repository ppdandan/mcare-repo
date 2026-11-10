// TODO: The clinic must review this privacy policy text before release.
import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_POLICY } from "@m-care/shared/privacy-policy";

export const metadata: Metadata = { title: "Privacy Policy | M-Care" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/login" className="text-pink-700 underline">Back to M-Care</Link>
      <article className="prose prose-rose mt-8 max-w-none whitespace-pre-wrap rounded-2xl bg-white p-8 shadow-sm">
        {PRIVACY_POLICY.trim()}
      </article>
    </main>
  );
}
