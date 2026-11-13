import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { twoFactor } from "@/lib/security";
import { getDict } from "@/lib/i18n/server";
import { SecurityPanel } from "@/components/dash/SecurityPanel";
import { Logo } from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.z.adm2faTitle, robots: { index: false } };
}

/** Admins land here until they turn on two-step sign-in — the admin panel stays closed until then. */
export default async function AdminTwoFactorSetup() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  if (await twoFactor.secret(user.id)) redirect("/admin");
  const { f } = await getDict();
  const z = f.z;
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <Logo />
      <section className="card mt-8 p-6">
        <h1 className="flex items-center gap-2 text-[22px] font-extrabold"><ShieldAlert size={22} className="text-amber-300" /> {z.adm2faTitle}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{z.adm2faText}</p>
        <div className="mt-6"><SecurityPanel twofaEnabled={false} /></div>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
          {/* full navigation so the server re-checks 2FA */}
          <a href="/admin" className="btn btn-primary">{z.adm2faGo}</a>
          <Link href="/api/auth/logout" prefetch={false} className="btn btn-ghost">{z.adm2faLogout}</Link>
        </div>
      </section>
    </main>
  );
}
