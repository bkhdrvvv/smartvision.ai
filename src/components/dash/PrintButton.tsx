"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button onClick={() => window.print()} className="btn btn-ghost !h-11 !rounded-xl">
      <Printer size={15} /> {label}
    </button>
  );
}
