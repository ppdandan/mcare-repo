import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card, { CardBody } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Request Account Deletion | M-Care" };

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <PublicHeader />
      <PageContainer className="max-w-2xl pb-12 pt-4">
        <Card><CardBody className="p-5 sm:p-8">
          <article>
            <h1 className="text-3xl font-bold tracking-tight text-base-content">Request account deletion</h1>
            <p className="mt-5 text-base leading-7 text-base-content/85">If you cannot use the M-Care app, contact the clinic through its official channels from the email address on your account and request deletion. The clinic may ask you to verify your identity before acting.</p>
            <p className="mt-4 text-base leading-7 text-base-content/85">Deleting an account removes its login and direct contact details and cancels future appointments. Clinical records and audit history may be retained without direct identifiers under the clinic’s approved retention schedule where required by law or otherwise lawfully necessary.</p>
            <p className="mt-4 text-base leading-7 text-base-content/85">The clinic will confirm when the request is completed or explain any records it must retain.</p>
          </article>
        </CardBody></Card>
      </PageContainer>
    </div>
  );
}
