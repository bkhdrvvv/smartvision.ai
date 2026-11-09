"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Star } from "lucide-react";
import { setReviewApproved, submitReview } from "@/app/actions/reviews";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return <span className="inline-flex gap-0.5 text-amber-400">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} fill={i <= n ? "currentColor" : "none"} />)}</span>;
}

/** Customer: leave a review (dashboard → support page). */
export function ReviewForm({ name }: { name: string }) {
  const { f } = useI18n();
  const x = f.x;
  const [rating, setRating] = useState(5);
  const [state, run, pending] = useActionState<ActionResult, FormData>(submitReview, undefined);
  if (state?.ok) return <p className="text-ok-soft">{x.reviewSent}</p>;
  return (
    <form action={run} className="space-y-3">
      <div>
        <span className="label">{x.reviewRating}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={String(i)} className="text-amber-400"><Star size={24} fill={i <= rating ? "currentColor" : "none"} /></button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>
      <label className="block"><span className="label">{x.reviewName}</span><input name="author" defaultValue={name} required minLength={2} maxLength={60} className="input" /></label>
      <label className="block"><span className="label">{x.reviewText}</span><textarea name="text" required minLength={10} maxLength={800} rows={3} className="input py-2.5" /></label>
      {state?.error && <p className="err">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : x.reviewSend}</button>
    </form>
  );
}

/** Admin: publish / hide a review. */
export function ReviewToggle({ id, approved }: { id: string; approved: boolean }) {
  const { f } = useI18n();
  const [v, setV] = useState(approved);
  const [busy, start] = useTransition();
  return (
    <button disabled={busy} onClick={() => start(async () => { await setReviewApproved(id, !v); setV(!v); })} className={cn("btn btn-sm", v ? "btn-ghost" : "btn-primary")}>
      {v ? <><EyeOff size={14} /> {f.x.hide}</> : <><Eye size={14} /> {f.x.approve}</>}
    </button>
  );
}
