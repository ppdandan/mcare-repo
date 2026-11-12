export default function HomePage() {
  return (
    <main className="hero min-h-screen bg-base-200 px-4 py-12">
      <div className="hero-content w-full max-w-2xl text-center">
        <section className="card w-full border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body items-center gap-5 p-8 sm:p-12">
            <img src="/logo.png" alt="M-Care Clinic" width={88} height={103} className="h-[103px] w-[88px] object-contain" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Balibago, Angeles City</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content sm:text-4xl">M-Care Clinic</h1>
              <p className="mt-3 text-base text-base-content/80">Clinic staff can sign in to manage appointments and patient care.</p>
            </div>
            <a href="/login" className="btn btn-primary min-h-12 w-full max-w-xs">Staff sign in</a>
            <p className="max-w-lg text-sm leading-6 text-base-content/80">
              Patients use the M-Care mobile app to book appointments and view their information.
              <span className="mt-1 block text-base-content/70">Mobile app store link: [to be added]</span>
            </p>
            <nav aria-label="Clinic information" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <a className="link link-primary" href="/privacy">Privacy policy</a>
              <a className="link link-primary" href="/delete-account">Delete account</a>
            </nav>
          </div>
        </section>
      </div>
    </main>
  );
}
