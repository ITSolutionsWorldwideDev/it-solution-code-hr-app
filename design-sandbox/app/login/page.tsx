"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

function crystalClass(position: string, rotate: string, size: string, glow: string) {
  return `${position} ${rotate} ${size} ${glow} absolute rounded-[18px] bg-[linear-gradient(135deg,#bde8ff_0%,#75b7dc_38%,#274153_84%,#151515_100%)] shadow-[0_0_28px_rgba(129,204,255,0.22)]`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const handleLogin = () => {
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-screen bg-[#090909] px-6 py-8 text-white md:px-10 md:py-10">
      <div className="pointer-events-none absolute left-6 top-5 z-10 md:left-8 md:top-6 lg:left-10 lg:top-8">
        <Image
          src="/isw-logo.png"
          alt="IT Solutions Worldwide"
          width={760}
          height={220}
          className="h-[110px] w-auto object-contain md:h-[130px] lg:h-[150px]"
          priority
        />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1240px] items-center justify-center pt-24 md:pt-28 lg:pt-32">
        <section className="relative grid min-h-[760px] w-full overflow-hidden rounded-[34px] border border-[#45647b] bg-[#0a0a0a] shadow-[0_0_50px_rgba(98,170,214,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden border-r border-[#1d2d39] bg-[radial-gradient(circle_at_0%_100%,rgba(129,204,255,0.22),transparent_22%),#080808]">
            <div className={crystalClass("left-[7%] top-[6%]", "-rotate-[38deg]", "h-[58px] w-[300px]", "")} />
            <div className={crystalClass("left-[22%] top-[24%]", "-rotate-[38deg]", "h-[64px] w-[420px]", "")} />
            <div className={crystalClass("left-[52%] top-[52%]", "-rotate-[38deg]", "h-[72px] w-[340px]", "")} />
            <div className={crystalClass("left-[58%] top-[16%]", "-rotate-[38deg]", "h-[58px] w-[280px]", "")} />
            <div className={crystalClass("left-[11%] bottom-[14%]", "-rotate-[38deg]", "h-[60px] w-[240px]", "opacity-70")} />
            <div className={crystalClass("left-[60%] bottom-[8%]", "-rotate-[38deg]", "h-[64px] w-[320px]", "")} />

            <div className="absolute inset-y-0 right-0 w-[120px] bg-[linear-gradient(90deg,transparent_0%,rgba(129,204,255,0.14)_100%)] blur-[20px]" />
            <div className="absolute bottom-0 left-0 h-24 w-40 bg-[radial-gradient(circle,rgba(129,204,255,0.32)_0%,transparent_72%)] blur-[28px]" />
            <div className="absolute left-0 top-0 h-24 w-40 bg-[radial-gradient(circle,rgba(129,204,255,0.18)_0%,transparent_72%)] blur-[28px]" />
          </div>

          <div className="relative flex items-center justify-center bg-[radial-gradient(circle_at_0%_20%,rgba(129,204,255,0.16),transparent_18%),radial-gradient(circle_at_0%_70%,rgba(129,204,255,0.1),transparent_18%),linear-gradient(180deg,#17191b_0%,#15181b_100%)] px-8 py-12 sm:px-12 lg:px-16">
            <div className="w-full max-w-[360px]">
              <h1 className="text-[3rem] font-medium tracking-[-0.05em] text-white sm:text-[3.4rem]">
                Welcome back
              </h1>
              <p className="mt-3 text-[1rem] text-[#bcc9d3]">Please enter your details.</p>

              <div className="mt-14 space-y-9">
                <label className="block">
                  <span className="block text-[0.98rem] font-medium text-white">E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your e-mail"
                    className="mt-4 h-12 w-full border-b border-[#4a6274] bg-transparent text-[1rem] text-white outline-none placeholder:text-[#8395a4]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[0.98rem] font-medium text-white">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="..........."
                    className="mt-4 h-12 w-full border-b border-[#4a6274] bg-transparent text-[1rem] text-white outline-none placeholder:text-[#8395a4]"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 text-[0.88rem] text-[#d2d8dd]">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember((value) => !value)}
                    className="h-4 w-4 rounded border border-[#6d89a0] bg-transparent accent-[#8fd7ff]"
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" className="text-[#f0f0e5] transition hover:text-[#8fd7ff]">
                  Forgot the password?
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                className="mt-16 flex h-[66px] w-full items-center justify-center rounded-[8px] bg-black text-[1.35rem] font-medium text-white transition hover:bg-[#0e0e0e]"
              >
                Log in
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-[0.92rem] text-[#bcc9d3]">
                <span>Don&apos;t have an account?</span>
                <button type="button" className="font-medium text-white transition hover:text-[#8fd7ff]">
                  Register here
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
