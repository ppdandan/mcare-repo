// TODO: The clinic must review this privacy policy text before release.
import type { Metadata } from "next";
import { PRIVACY_POLICY } from "@m-care/shared/privacy-policy";
import PublicHeader from "@/components/PublicHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card, { CardBody } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Privacy Policy | M-Care" };

export default function PrivacyPage() {
  const content = PRIVACY_POLICY.trim().split("\n").filter((line) => !line.startsWith("# Privacy Policy"));
  return (
    <div className="min-h-screen bg-base-200">
      <PublicHeader />
      <PageContainer className="max-w-3xl pb-12 pt-4">
        <Card>
          <CardBody className="p-5 sm:p-8">
          <article>
          <h1 className="text-3xl font-bold tracking-tight text-base-content">Privacy Policy</h1>
          <div className="mt-5 space-y-4 text-base leading-7 text-base-content/85">
            {content.map((line, index) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("## ")) return <h2 key={index} className="pt-3 text-xl font-bold leading-7 text-base-content">{trimmed.slice(3)}</h2>;
              if (trimmed.startsWith("Effective date:")) return <p key={index} className="text-sm font-semibold text-base-content/75">{trimmed}</p>;
              return <p key={index}>{trimmed}</p>;
            })}
          </div>
          </article>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
