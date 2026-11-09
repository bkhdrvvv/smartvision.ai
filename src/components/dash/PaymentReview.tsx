"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CheckCircle2, Download, Expand, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { decidePayment, startReview } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { cn, money } from "@/lib/format";

export type ReviewDTO = {
  id: string; reference: string; org: string; status: string; amount: number; plan: string; period: string; paidTo: string;
  receipt: { name: string; size: number; mime: string } | null; adminNote: string | null;
};

const FLOW = ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "ACTIVE"];

export function PaymentReview({ p }: { p: ReviewDTO | null }) {
  const { d } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const a = d.dash.adminPay;

  if (!p) return <section className="card grid min-h-[300px] place-items-center !rounded-[20px] p-6 text-fg-dim">{a.select}</section>;
  const canDecide = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(p.status);
  const flowIdx = p.status === "APPROVED" ? 5 : p.status === "REJECTED" ? 2 : FLOW.indexOf(p.status);

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      setMsg(r?.error ? `${d.common.error} (${r.error})` : a.done);
      router.refresh();
    });

  return (
    <section className="card space-y-4 !rounded-[20px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[13px] text-fg-dim">{p.reference}</div>
          <div className="text-[22px] font-bold">{p.org}</div>
        </div>
        <span className={cn("chip", p.status === "APPROVED" ? "chip-ok" : p.status === "REJECTED" ? "chip-bad" : p.status === "UNDER_REVIEW" ? "chip-violet" : p.status === "RECEIPT_SUBMITTED" ? "chip-blue" : "chip-warn")}>{d.dash.status[p.status as keyof typeof d.dash.status]}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-[#eef1f6]">
        {p.receipt ? (
          p.receipt.mime === "application/pdf" ? (
            <div className="grid h-[300px] place-items-center text-ink-700"><FileText size={48} /></div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/receipts/${p.id}`} alt="Receipt" className="h-[340px] w-full object-contain" />
          )
        ) : (
          <div className="grid h-[200px] place-items-center text-sm text-ink-600">{a.noReceipt}</div>
        )}
        {p.receipt && (
          <>
            <span className="absolute left-3 top-3 rounded-full bg-ink-900/85 px-3 py-1 text-[13px] font-semibold">{p.receipt.name} · {Math.round(p.receipt.size / 1024)} KB</span>
            <div className="absolute bottom-3 right-3 flex gap-2">
              <a href={`/api/receipts/${p.id}`} target="_blank" className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900/90" aria-label="Open"><Expand size={16} /></a>
              <a href={`/api/receipts/${p.id}`} download={p.receipt.name} className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900/90" aria-label="Download"><Download size={16} /></a>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Info k={a.expected} v={`${money(p.amount)} ${d.common.uzs}`} />
        <Info k={a.planLabel} v={p.plan} />
        <Info k={a.period} v={p.period} />
        <Info k={a.paidTo} v={p.paidTo} />
      </div>

      <div className="flex gap-3 rounded-xl border border-warn/40 bg-warn/[.06] p-4 text-[14px] text-warn-soft">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" /> {a.verify}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("chip !rounded-lg", i < flowIdx ? "chip-ok" : i === flowIdx ? "chip-blue" : "")}>{d.dash.status[s as keyof typeof d.dash.status]}</span>
            {i < FLOW.length - 1 && <ChevronRight size={13} className="text-fg-dim" />}
          </span>
        ))}
      </div>

      {p.adminNote && <p className="text-sm text-fg-muted">“{p.adminNote}”</p>}

      {canDecide && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={a.note} rows={3} className="input" maxLength={500} />
          {p.status === "RECEIPT_SUBMITTED" && (
            <button disabled={pending} onClick={() => act(() => startReview(p.id))} className="btn btn-ghost w-full">{a.startReview}</button>
          )}
          <div className="grid grid-cols-[1fr_1.6fr] gap-3">
            <button disabled={pending} onClick={() => act(() => decidePayment(p.id, "reject", note))} className="btn btn-bad btn-lg"><XCircle size={17} /> {a.reject}</button>
            <button disabled={pending || !p.receipt} onClick={() => act(() => decidePayment(p.id, "approve", note))} className="btn btn-ok btn-lg">{pending ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} {a.approve}</button>
          </div>
        </>
      )}
      {msg && <p className="text-center text-sm text-fg-muted">{msg}</p>}
      <Link href="/admin/payments" className="sr-only">back</Link>
    </section>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-850/70 p-3.5">
      <div className="text-[13px] text-fg-dim">{k}</div>
      <div className="mt-1 font-bold">{v}</div>
    </div>
  );
}
