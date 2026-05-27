"use client";

import { type ReactNode, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

function LionCircuitLogo() {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className="h-20 w-20 shrink-0 text-white sm:h-24 sm:w-24"
      fill="none"
    >
      <path
        d="M27 74V58.5L18 49.5V34l9.5-7.5L35 15h16l8 6 10 2.5 8 9v14l-8 8v15.5l-11-6.5-10 5.5-10-5.5L27 74Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M37 36.5 48 29l11 7.5M40 46h16M42 56.5h12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 15v-8M59 21V9M18 34H9M77 32h10M18 49.5H7M79 46h10M27 74l-5 8M69 70l6 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="35" cy="7" r="3" fill="currentColor" />
      <circle cx="59" cy="9" r="3" fill="currentColor" />
      <circle cx="9" cy="34" r="3" fill="currentColor" />
      <circle cx="87" cy="32" r="3" fill="currentColor" />
      <circle cx="7" cy="49.5" r="3" fill="currentColor" />
      <circle cx="89" cy="46" r="3" fill="currentColor" />
      <circle cx="22" cy="82" r="3" fill="currentColor" />
      <circle cx="75" cy="79" r="3" fill="currentColor" />
    </svg>
  );
}

function IswMonogram() {
  return (
    <svg
      viewBox="0 0 200 84"
      aria-hidden="true"
      className="h-14 w-32 text-white/20 sm:h-16 sm:w-36"
      fill="none"
    >
      <path d="M14 18h30M29 18v48M14 66h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M74 22c4-4 10-6 17-6 13 0 22 6 22 15 0 8-7 12-18 15l-7 2c-8 2-12 5-12 10 0 6 6 10 16 10 8 0 14-2 19-7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m132 18 13 48 12-35 12 35 13-48"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircuitBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] overflow-hidden lg:block"
    >
      <div className="absolute inset-y-0 right-[-12%] w-full bg-[radial-gradient(circle_at_65%_34%,rgba(34,211,238,0.22),transparent_20%),radial-gradient(circle_at_58%_56%,rgba(45,212,191,0.20),transparent_22%),radial-gradient(circle_at_76%_72%,rgba(56,189,248,0.18),transparent_24%)] blur-2xl" />
      <svg viewBox="0 0 720 960" className="absolute inset-y-0 right-[-8%] h-full w-[110%] text-cyan-300/35">
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M600 80H418v96H316v128H228v118H132" />
          <path d="M634 160H492v94H388v126H286v116H198" />
          <path d="M622 302H504v92H426v120H330v110H254" />
          <path d="M656 432H542v88H450v112H370v92H294" />
          <path d="M640 554H530v78H448v100H382v72H314" />
          <path d="M570 92v126h-72v84h-88v120h-70" />
          <path d="M480 150v92h-68v88h-92v102h-76" />
          <path d="M594 350v108h-76v78h-94v94h-72" />
          <path d="M544 486v96h-82v82h-86v80h-60" />
        </g>
        <g fill="#67e8f9">
          <circle cx="600" cy="80" r="5" />
          <circle cx="418" cy="176" r="5" />
          <circle cx="228" cy="422" r="5" />
          <circle cx="634" cy="160" r="5" />
          <circle cx="388" cy="254" r="5" />
          <circle cx="198" cy="496" r="5" />
          <circle cx="622" cy="302" r="5" />
          <circle cx="426" cy="394" r="5" />
          <circle cx="254" cy="624" r="5" />
          <circle cx="656" cy="432" r="5" />
          <circle cx="450" cy="520" r="5" />
          <circle cx="294" cy="724" r="5" />
          <circle cx="570" cy="218" r="5" />
          <circle cx="410" cy="422" r="5" />
          <circle cx="352" cy="630" r="5" />
        </g>
      </svg>
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#070b12] via-[#070b12]/70 to-transparent" />
    </div>
  );
}

type LoginFieldProps = {
  icon: ReactNode;
  trailing?: ReactNode;
  type?: string;
  placeholder: string;
  defaultValue?: string;
};

function LoginField({ icon, trailing, type = "text", placeholder, defaultValue }: LoginFieldProps) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-3xl border border-slate-700/70 bg-slate-950/70 px-4 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300/15">
      <span className="text-slate-400">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
      />
      {trailing}
    </label>
  );
}

export function DarkLoginScreen() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(22,163,184,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.10),transparent_24%),linear-gradient(135deg,#070b12_0%,#0b1120_44%,#090d16_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <CircuitBackdrop />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-200/5 to-transparent" />
      <div className="pointer-events-none absolute left-[14%] top-[18%] h-56 w-56 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[14%] left-[8%] h-48 w-48 rounded-full bg-teal-300/8 blur-3xl" />

      <section className="relative z-10 flex w-full max-w-md items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/40 p-6 backdrop-blur-md shadow-[0_32px_90px_rgba(2,10,24,0.65)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
          <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-20 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative flex min-h-[680px] flex-col">
            <div className="flex items-start gap-4">
              <LionCircuitLogo />
              <div className="pt-3">
                <p className="max-w-[11rem] text-lg font-semibold leading-6 tracking-[0.01em] text-white sm:text-xl">
                  IT Solutions Worldwide
                </p>
              </div>
            </div>

            <div className="mx-auto mt-14 w-full max-w-sm flex-1">
              <div className="text-center">
                <h1 className="text-3xl font-bold tracking-[0.18em] text-white sm:text-[2.15rem]">LOG IN</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Secure employee access to the IT network environment.
                </p>
              </div>

              <form className="mt-10 space-y-4">
                <LoginField
                  icon={<Mail className="h-5 w-5" />}
                  placeholder="Email Address"
                  type="email"
                />

                <LoginField
                  icon={<LockKeyhole className="h-5 w-5" />}
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  defaultValue="password123"
                  trailing={
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-slate-400 transition hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  }
                />

                <button
                  type="button"
                  className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-3xl bg-sky-400 text-base font-semibold text-white shadow-[0_16px_34px_rgba(56,189,248,0.25)] transition hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200/60"
                >
                  Log in
                </button>
              </form>
            </div>

            <div className="mt-10 flex justify-end">
              <IswMonogram />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
