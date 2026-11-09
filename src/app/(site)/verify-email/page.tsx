import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthShell } from "@/components/site/AuthShell";
import { consumeAuthToken } from "@/lib/authTokens";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { d } = await getDict();
  const { t = "" } = await searchParams;
  const uid = await consumeAuthToken(t, "VERIFY_EMAIL");
  if (uid) {
    await db.user.update({ where: { id: uid }, data: { emailVerifiedAt: new Date() } });
    await audit(uid, "auth.email_verified");
  }
  return (
    <AuthShell title={uid ? d.auth.verified : d.auth.linkInvalid} text={uid ? d.auth.verifiedText : d.auth.verifyExpired}>
      <div className="space-y-4 text-center">
        {uid ? <CheckCircle2 size={44} className="mx-auto text-ok-soft" /> : <XCircle size={44} className="mx-auto text-bad-soft" />}
        <Link href="/dashboard" className="btn btn-primary">{d.nav.dashboard}</Link>
      </div>
    </AuthShell>
  );
}
