export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f4f8fd_0%,#eef5fd_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(7,105,231,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.12),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-14">
          <section className="hidden rounded-[32px] border border-white/60 bg-[#0f2d55] p-10 text-white shadow-[0_24px_70px_rgba(15,45,85,0.22)] lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                Dentix for Ethiopia
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.05em]">
                  Run a modern dental clinic with workflows shaped for Addis Ababa teams.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-200">
                  Appointments, patient history, treatment plans, ETB billing, and multilingual
                  communication stay in one workspace built for Habesha clinics.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/8 p-5">
                <p className="text-2xl font-semibold">ETB</p>
                <p className="mt-2 text-sm text-slate-200">Finance-ready pricing and collections</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 p-5">
                <p className="text-2xl font-semibold">EN / አማ</p>
                <p className="mt-2 text-sm text-slate-200">English and Amharic-ready patient flows</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 p-5">
                <p className="text-2xl font-semibold">1 view</p>
                <p className="mt-2 text-sm text-slate-200">Reception, clinical care, and billing aligned</p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
