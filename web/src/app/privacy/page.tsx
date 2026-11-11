// TODO: The clinic must review this privacy policy text before release.
import type { Metadata } from "next";
import { PRIVACY_POLICY } from "@m-care/shared/privacy-policy";
import PublicHeader from "@/components/PublicHeader";

export const metadata: Metadata = { title: "Privacy Policy | M-Care" };

export default function PrivacyPage() {
  const content = PRIVACY_POLICY.trim().split("\n").filter((line) => !line.startsWith("# Privacy Policy"));
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
          <div className="mt-5 space-y-4 text-base leading-7 text-gray-700">
            {content.map((line, index) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("## ")) return <h2 key={index} className="pt-3 text-xl font-bold leading-7 text-gray-900">{trimmed.slice(3)}</h2>;
              if (trimmed.startsWith("Effective date:")) return <p key={index} className="text-sm font-semibold text-gray-600">{trimmed}</p>;
              return <p key={index}>{trimmed}</p>;
            })}
          </div>
        </article>
      </main>
    </div>
  );
}
