import Link from "next/link";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    // camera shutter + AI eye (public/icon.svg, source in brand/v2)
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.svg" alt="" width={size} height={size} className="shrink-0 rounded-[24%] shadow-[0_0_24px_-6px_rgba(59,130,246,.8)]" style={{ width: size, height: size }} />
  );
}

export function Logo({ href = "/", size = 34 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-3 whitespace-nowrap font-bold tracking-wide" aria-label="SMARTVISION AI">
      <LogoMark size={size} />
      <span className="text-[15px] sm:text-[17px]">
        SMARTVISION <span className="bg-[linear-gradient(90deg,#22d3ee,#a78bfa)] bg-clip-text font-semibold text-transparent">AI</span>
      </span>
    </Link>
  );
}
