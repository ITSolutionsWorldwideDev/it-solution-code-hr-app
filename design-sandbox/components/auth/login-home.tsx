"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Building2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useRole } from "@/components/providers/role-provider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  prototypeRoles,
  roleLandingRoutes,
  roleProfiles,
  roleWorkspaceLabels,
  type AppRole,
} from "@/lib/session";

const platformHighlights = [
  {
    title: "Role-based workspaces",
    description:
      "Unified HR, technical, management, and admin access platforms drive next steps for hiring teams.",
    icon: Users,
  },
  {
    title: "AI-ready hiring flow",
    description:
      "AI generates job descriptions, parses resumes, and funnels candidates for team approvals.",
    icon: Sparkles,
  },
  {
    title: "Controlled employee data",
    description:
      "Access viewed resumes by department. Securely manage internal candidates' data through user authentication.",
    icon: ShieldCheck,
  },
];

export function LoginHome() {
  const router = useRouter();
  const { setSession } = useRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("HR");

  const handleLogin = () => {
    setSession({
      role: selectedRole,
      name: roleProfiles[selectedRole].name,
    });
    router.push(roleLandingRoutes[selectedRole]);
  };

  return (
    <div className="min-h-screen bg-[#020202] px-2 py-2 lg:px-3 lg:py-3">
      <div className="relative mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1860px] flex-col rounded-[32px] bg-[#020202] px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] lg:px-8 lg:py-6">
        <div className="pointer-events-none absolute -right-28 top-8 z-50 hidden h-[620px] w-[1160px] origin-right overflow-hidden lg:block">
            <Image
              src="/newitsolutions.png"
              alt=""
              fill
              priority
            className="object-contain object-right-top opacity-[0.22]"
            sizes="1160px"
          />
        </div>

        <header className="flex w-full items-start gap-6" />

        <main className="flex flex-1 flex-col">
          <section className="relative pt-7 lg:pt-10">
            <div className="relative z-10 max-w-[1120px]">
              <p className="text-[0.88rem] font-semibold uppercase tracking-[0.34em] text-[#6eaed1] lg:text-[0.92rem]">
                AI Recruitment Platform
              </p>

              <h1 className="mt-4 max-w-[1120px] text-[4rem] font-semibold leading-[0.92] tracking-[-0.08em] text-[#e6eaee] sm:text-[4.9rem] lg:text-[6.35rem]">
                One hiring workspace built for every decision maker.
              </h1>

              <p className="mt-6 max-w-[1180px] text-[1.18rem] leading-[1.95rem] text-[#c9d3db] lg:text-[1.26rem] lg:leading-[2.05rem]">
                IT Solutions Worldwide centralizes AI job descriptions, candidate review,
                technical approvals, management decisions, onboarding, and organizational
                visibility in one professional recruitment environment.
              </p>

              <div
                id="employee-login"
                className="mt-8 max-w-[960px] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-[#dbe8f2]">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="bob@itsolutions.com"
                      className="h-14"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-[#dbe8f2]">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="password123"
                      className="h-14"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleLogin();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-[#dbe8f2]">Workspace</label>
                    <Select
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value as AppRole)}
                      className="h-14"
                    >
                      {prototypeRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleWorkspaceLabels[role]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="inline-flex h-[68px] items-center justify-center gap-3 rounded-full bg-[#466d8a] px-9 text-[1.08rem] font-semibold text-white shadow-[0_16px_36px_rgba(70,109,138,0.34)] transition hover:scale-[1.01] lg:h-14 lg:text-[1rem]"
                  >
                    Log in
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>

                <p className="mt-4 text-sm text-[#9aabb8]">
                  Choose a temporary workspace for the prototype. HR manages intake and shortlists, Technical reviews interview candidates, and Management handles final selection and offers.
                </p>

              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-12">
            {platformHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="min-h-[260px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.24)] lg:min-h-[280px]"
                >
                  <Icon className="h-7 w-7 text-[#93b9d3]" />
                  <h3 className="mt-5 max-w-[240px] text-[1.08rem] font-semibold leading-7 tracking-[-0.03em] text-white lg:text-[1.12rem]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-[0.96rem] leading-8 text-[#b8c5cf]">{item.description}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-auto pt-10">
            <div className="flex items-center justify-between gap-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] lg:px-8 lg:py-7">
              <div>
                <p className="text-[0.88rem] font-semibold uppercase tracking-[0.34em] text-[#84b6d8]">
                  Enterprise Access
                </p>
                <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.05em] text-white lg:text-[1.85rem]">
                  IT Solutions Worldwide
                </h2>
                <p className="mt-3 max-w-[980px] text-[1rem] leading-8 text-[#c0cbd3]">
                  A single command center for hiring teams, candidate quality, approvals,
                  onboarding readiness, and organizational visibility.
                </p>
              </div>

              <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.03)] text-[#9bc3de] lg:flex">
                <Building2 className="h-8 w-8" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
