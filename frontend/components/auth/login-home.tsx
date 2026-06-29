"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";
import { ArrowRight, Building2, LoaderCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useRole } from "@/components/providers/role-provider";
import { apiRequest } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import {
  getDisplayNameFromEmail,
  roleLandingRoutes,
} from "@/lib/session";

type AuthSessionResponse = {
  user_id: number;
  email: string;
  role: "HR" | "Technical" | "Manager" | "Admin";
  name: string;
};

type PublicAuthSettingsResponse = {
  login_support_message: string;
  maintenance_banner_message: string;
  maintenance_mode_notice_enabled: boolean;
};

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
  const [nextRoute, setNextRoute] = useState(roleLandingRoutes.HR);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusMessage, setSubmitStatusMessage] = useState("");
  const [loginSupportMessage, setLoginSupportMessage] = useState("Internal access uses your email address and the shared company password.");
  const [maintenanceNotice, setMaintenanceNotice] = useState("");
  const canLogin = email.trim().length > 0 && password.trim().length > 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const requestedRoute = new URLSearchParams(window.location.search).get("next");
    setNextRoute(requestedRoute || roleLandingRoutes.HR);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPublicAuthSettings = async () => {
      try {
        const payload = await apiRequest<PublicAuthSettingsResponse>({
          path: "/settings/public-auth",
          method: "GET",
        });

        if (cancelled) {
          return;
        }

        setLoginSupportMessage(payload.login_support_message || "Internal access uses your email address and the shared company password.");
        setMaintenanceNotice(
          payload.maintenance_mode_notice_enabled ? payload.maintenance_banner_message : ""
        );
      } catch {
        if (!cancelled) {
          setLoginSupportMessage("Internal access uses your email address and the shared company password.");
          setMaintenanceNotice("");
        }
      }
    };

    void loadPublicAuthSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    if (!canLogin) {
      return;
    }

    const normalizedEmail = email.trim();
    const emailInput = normalizedEmail.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSubmitStatusMessage("Verifying your credentials...");

    try {
      const authSession = await apiRequest<AuthSessionResponse>({
        path: "/auth/login",
        method: "POST",
        body: JSON.stringify({
          email: emailInput,
          password,
        }),
      });

      setSubmitStatusMessage("Opening your workspace...");
      const resolvedRole = authSession.role;
      const resolvedName =
        authSession.name ||
        getDisplayNameFromEmail(authSession.email) ||
        "Internal User";
      setSession({
        userId: authSession.user_id,
        email: authSession.email,
        role: resolvedRole,
        name: resolvedName,
      });
      const fallbackRoute = roleLandingRoutes[resolvedRole];
      startTransition(() => {
        router.push(nextRoute || fallbackRoute);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not log in.");
      setSubmitStatusMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#0d1116_0%,#141a20_100%)] px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] lg:px-8 lg:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(99,231,255,0.12),transparent_18%),radial-gradient(circle_at_88%_18%,rgba(147,239,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.02))]" />

        <div className="relative mx-auto flex min-h-full w-full max-w-[1840px] flex-1 flex-col">
          <header className="relative z-10 flex w-full items-start justify-between gap-6">
            <div />
            <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-[#10161c] px-4 py-2 text-sm text-[#9aa7b5] lg:flex">
              <Sparkles className="h-4 w-4 text-[#63e7ff]" />
              Recruitment workspace
            </div>
          </header>

          <div className="pointer-events-none absolute right-[-120px] top-[-10px] hidden h-[84vh] w-[min(72vw,1180px)] lg:block">
            <Image
              src="/final-logo.png"
              alt="Talent Genie logo"
              fill
              priority
              className="object-contain object-right-top opacity-[0.11]"
              sizes="72vw"
            />
          </div>

          <main className="flex flex-1 flex-col">
            <section className="relative pt-7 lg:pt-10">
              <div className="relative z-10 max-w-[1120px]">
              <p className="text-[0.88rem] font-semibold uppercase tracking-[0.34em] text-[#93efff] lg:text-[0.92rem]">
                Talent Genie
              </p>

              <h1 className="mt-4 max-w-[1120px] text-[4rem] font-semibold leading-[0.92] tracking-[-0.08em] text-[#e6eaee] sm:text-[4.9rem] lg:text-[6.35rem]">
                Talent Genie powers every hiring decision.
              </h1>

              <p className="mt-6 max-w-[1180px] text-[1.18rem] leading-[1.95rem] text-[#c2cbc5] lg:text-[1.26rem] lg:leading-[2.05rem]">
                Talent Genie centralizes AI job descriptions, candidate review,
                technical approvals, management decisions, onboarding, and organizational
                visibility in one intelligent recruitment environment.
              </p>

                <div
                  id="employee-login"
                  className="mt-8 max-w-[960px] rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,22,28,0.98)_0%,rgba(20,26,32,0.94)_100%)] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur"
                >
                  {maintenanceNotice ? (
                    <div className="mb-4 rounded-[18px] border border-[#63e7ff]/20 bg-[#10161c] px-4 py-3 text-sm text-[#dbe8f2]">
                      {maintenanceNotice}
                    </div>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-[#dbe8f2]">Email</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="bob@itsolutions.com"
                        className="h-14"
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleLogin();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLogin()}
                      disabled={!canLogin || isSubmitting}
                      className="inline-flex h-[68px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-9 text-[1.08rem] font-semibold text-[#06141c] shadow-[0_16px_36px_rgba(0,0,0,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 lg:h-14 lg:text-[1rem]"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Log in
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>

                  {errorMessage ? (
                    <p className="mt-4 text-sm text-[#ffb4b4]">{errorMessage}</p>
                  ) : null}

                  {isSubmitting && submitStatusMessage ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-[#a9e9ff]">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span>{submitStatusMessage}</span>
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm text-[#8fa2b5]">
                    {loginSupportMessage}
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
                    className="min-h-[260px] rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,22,28,0.98)_0%,rgba(20,26,32,0.94)_100%)] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.24)] lg:min-h-[280px]"
                  >
                    <Icon className="h-7 w-7 text-[#93efff]" />
                    <h3 className="mt-5 max-w-[240px] text-[1.08rem] font-semibold leading-7 tracking-[-0.03em] text-white lg:text-[1.12rem]">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-[0.96rem] leading-8 text-[#b8c5bf]">{item.description}</p>
                  </div>
                );
              })}
            </section>

            <section className="mt-auto pt-10">
              <div className="flex items-center justify-between gap-6 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,22,28,0.98)_0%,rgba(20,26,32,0.94)_100%)] px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] lg:px-8 lg:py-7">
                <div>
                  <p className="text-[0.88rem] font-semibold uppercase tracking-[0.34em] text-[#93efff]">
                    Enterprise Access
                  </p>
                  <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.05em] text-white lg:text-[1.85rem]">
                    Talent Genie
                  </h2>
                  <p className="mt-3 max-w-[980px] text-[1rem] leading-8 text-[#c0cbc3]">
                    A single command center for hiring teams, candidate quality, approvals,
                    onboarding readiness, and organizational visibility.
                  </p>
                </div>

                <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.03)] text-[#93efff] lg:flex">
                  <Building2 className="h-8 w-8" />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
