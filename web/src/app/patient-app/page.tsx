export default function PatientAppNoticePage() {
  return (
    <main className="hero min-h-screen bg-base-200 px-4 py-12">
      <div className="hero-content w-full max-w-xl text-center">
        <section className="card w-full border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body items-center gap-5 p-8">
            <img src="/logo.png" alt="M-Care Clinic" width={72} height={84} className="h-[84px] w-[72px] object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-base-content">Use the M-Care mobile app</h1>
              <p className="mt-3 text-base leading-7 text-base-content/80">
                Patient booking, appointments, profile details, and transaction history are available in the M-Care mobile app.
              </p>
              <p className="mt-2 text-sm text-base-content/70">Mobile app store link: [to be added]</p>
            </div>
            <a href="/" className="btn btn-outline">Return to clinic home</a>
          </div>
        </section>
      </div>
    </main>
  );
}
