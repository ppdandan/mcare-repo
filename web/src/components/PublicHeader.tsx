import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link href="/login" className="inline-flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700">
        <img src="/logo.png" alt="M-Care" width={36} height={42} className="h-10 w-9 object-contain" />
        <span><strong className="block text-base font-bold text-gray-900">M-Care Clinic</strong><span className="block text-sm text-gray-600">Patient information</span></span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Public navigation">
        <Link href="/privacy" className="rounded-lg px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50">Privacy</Link>
        <Link href="/delete-account" className="rounded-lg px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50">Account deletion</Link>
        <Link href="/login" className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">Sign in</Link>
      </nav>
    </header>
  );
}
