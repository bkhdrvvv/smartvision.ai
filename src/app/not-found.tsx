import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <div className="display grad-text text-[120px]">404</div>
        <Link href="/" className="btn btn-primary mt-6">SMARTVISION AI</Link>
      </div>
    </div>
  );
}
