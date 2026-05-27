"use client";

import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, Network, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";

const highlights = [
  {
    title: "AI-driven hiring",
    description: "Generate job descriptions, parse resumes, and rank candidates with a workflow built for recruitment teams.",
    icon: Sparkles,
  },
  {
    title: "Role-aware workspaces",
    description: "HR, Technical, and Management move through the same hiring journey with the right screen for each step.",
    icon: Network,
  },
  {
    title: "Operational control",
    description: "Keep pipeline decisions, onboarding progress, and organizational structure aligned in one platform.",
    icon: BriefcaseBusiness,
  },
];

export function LandingHome() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,100,121,0.16),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(1,103,123,0.12),transparent_28%),linear-gradient(180deg,#f9feff_0%,#edf9fb_100%)] px-4 py-5 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1720px] overflow-hidden rounded-[40px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(244,252,253,0.92)_48%,rgba(255,255,255,0.96)_100%)] shadow-[0_30px_90px_rgba(0,100,121,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden px-8 py-8 lg:px-14 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(1,104,125,0.12),transparent_18%),radial-gradient(circle_at_12%_88%,rgba(0,102,124,0.10),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.68)_0%,rgba(244,251,252,0.86)_100%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-6">
              <BrandLogo className="h-[96px] w-[340px]" src="/ITSW Neon.png" />
              <Link
                href="/login"
                className="inline-flex h-[56px] items-center justify-center rounded-full border border-[rgba(0,100,121,0.16)] bg-[linear-gradient(135deg,#006479_0%,#01687D_100%)] px-8 text-[1rem] font-semibold text-white shadow-[0_18px_35px_rgba(0,100,121,0.18)] transition hover:scale-[1.01]"
              >
                Login
              </Link>
            </div>

            <div className="mt-14 max-w-[680px]">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#01677B]">
                AI Recruitment Platform
              </p>
              <h1 className="mt-6 text-[3.7rem] font-semibold tracking-[-0.06em] text-[#16324A] lg:text-[4.4rem] lg:leading-[1.02]">
                Smarter hiring for every team inside IT Solutions Worldwide.
              </h1>
              <p className="mt-7 max-w-[620px] text-[1.15rem] leading-8 text-[#5f748b]">
                A professional recruitment workspace for HR, technical reviewers, and management teams. Create better job descriptions, review stronger candidates, and move hiring decisions forward with confidence.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex h-[60px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#006479_0%,#01687D_100%)] px-8 text-[1rem] font-semibold text-white shadow-[0_22px_40px_rgba(0,100,121,0.18)] transition hover:scale-[1.01]"
                >
                  Open Employee Portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="inline-flex h-[60px] items-center gap-3 rounded-full border border-[rgba(0,100,121,0.15)] bg-white/80 px-6 text-[0.98rem] font-medium text-[#33526b] shadow-sm">
                  <Bot className="h-5 w-5 text-[#01677B]" />
                  Powered by AI recruitment workflows
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-[30px] border border-[rgba(0,100,121,0.10)] bg-white/88 p-6 shadow-[0_14px_34px_rgba(0,100,121,0.08)] backdrop-blur"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(1,103,123,0.08)] text-[#01677B]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-[1.12rem] font-semibold text-[#16324A]">{item.title}</p>
                    <p className="mt-3 text-[0.98rem] leading-7 text-[#6a7f95]">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-10">
              <div className="rounded-[34px] border border-[rgba(0,100,121,0.10)] bg-white/84 p-6 shadow-[0_16px_34px_rgba(0,100,121,0.06)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#01677B]">
                  Enterprise-ready foundation
                </p>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[#16324A]">
                    IT Solutions Worldwide recruitment workspace
                  </p>
                  <p className="max-w-[420px] text-[0.98rem] leading-7 text-[#6a7f95]">
                    Built to support AI job descriptions, candidate parsing, ranking, onboarding, and role-based collaboration across the full hiring lifecycle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[rgba(0,100,121,0.08)] px-8 py-8 lg:border-l lg:border-t-0 lg:px-10 lg:py-10">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(242,250,251,0.96)_100%)]" />
          <div className="relative flex h-full items-center justify-center">
            <div className="relative flex h-full min-h-[720px] w-full max-w-[680px] items-center justify-center overflow-hidden rounded-[38px] border border-[rgba(0,100,121,0.10)] bg-[linear-gradient(160deg,rgba(255,255,255,0.94)_0%,rgba(236,248,250,0.96)_42%,rgba(226,244,247,0.98)_100%)] shadow-[0_24px_60px_rgba(0,100,121,0.08)]">
              <div className="absolute -left-12 top-16 h-56 w-56 rounded-full bg-[rgba(0,100,121,0.12)] blur-3xl" />
              <div className="absolute -right-10 top-8 h-64 w-64 rounded-full bg-[rgba(1,104,125,0.14)] blur-3xl" />
              <div className="absolute bottom-0 left-10 h-52 w-52 rounded-full bg-[rgba(1,103,123,0.12)] blur-3xl" />

              <div className="relative w-full max-w-[560px] px-8 py-10">
                <div className="rounded-[34px] border border-[rgba(0,100,121,0.10)] bg-white/92 p-6 shadow-[0_20px_50px_rgba(0,100,121,0.08)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#01677B]">
                        Recruitment command center
                      </p>
                      <p className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[#16324A]">
                        One platform for every hiring stage.
                      </p>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(145deg,#006479_0%,#01687D_100%)] text-white shadow-[0_16px_30px_rgba(0,100,121,0.18)]">
                      <Sparkles className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {[
                      "Generate role-specific job descriptions in seconds",
                      "Parse resumes and map candidates to vacancies",
                      "Coordinate HR, technical, and management decisions",
                      "Track onboarding and organizational readiness",
                    ].map((line) => (
                      <div
                        key={line}
                        className="flex items-center gap-4 rounded-[22px] border border-[rgba(0,100,121,0.10)] bg-[#f9fcfd] px-4 py-4"
                      >
                        <div className="h-3 w-3 rounded-full bg-[#01677B]" />
                        <p className="text-[0.98rem] text-[#35526a]">{line}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-[28px] bg-[linear-gradient(135deg,#006479_0%,#01677B_100%)] px-6 py-6 text-white shadow-[0_20px_40px_rgba(0,100,121,0.16)]">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80">
                      Employee access
                    </p>
                    <p className="mt-3 text-[1.55rem] font-semibold tracking-[-0.04em]">
                      Login to continue into your workspace
                    </p>
                    <p className="mt-3 text-[0.98rem] leading-7 text-white/85">
                      Move directly into the correct environment for HR operations, technical interviews, management review, or platform oversight.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
