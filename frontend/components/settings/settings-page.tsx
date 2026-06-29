"use client";

import { useEffect, useState } from "react";
import { Save, UserRound } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useRole } from "@/components/providers/role-provider";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";

type UserSettingsResponse = {
  profile: {
    full_name: string;
    email: string;
    preferred_display_name: string;
    timezone: string;
    default_landing_page: string;
      role: string;
      department_name: string | null;
      account_created_at: string | null;
  };
  preferences: {
    reduced_motion: boolean;
  };
};

function metaCard(label: string, value: string) {
  return (
    <div className="rounded-xl border border-[#3c494c] bg-[#0d1c2d] p-6 transition hover:border-[#2fd9f4] hover:bg-[#1c2b3c]">
      <span className="font-[var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.1em] text-[#859397]">{label}</span>
      <p className="mt-2 text-[1.1rem] font-semibold leading-8 text-[#d4e4fa]">{value}</p>
    </div>
  );
}

export function SettingsPage() {
  const { email, role, userId, setSession } = useRole();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [profileDraft, setProfileDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError("");
        const payload = await apiRequest<UserSettingsResponse>({
          path: "/settings/me",
          method: "GET",
        });

        if (cancelled) {
          return;
        }

        setSettings(payload);
        setProfileDraft({
          full_name: payload.profile.full_name,
          email: payload.profile.email,
          preferred_display_name: payload.profile.preferred_display_name,
          timezone: payload.profile.timezone,
        });

        if (typeof document !== "undefined") {
          document.documentElement.dataset.reducedMotion = payload.preferences.reduced_motion ? "true" : "false";
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load settings.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const profileDirty = settings
    ? JSON.stringify(profileDraft) !==
      JSON.stringify({
        full_name: settings.profile.full_name,
        email: settings.profile.email,
        preferred_display_name: settings.profile.preferred_display_name,
        timezone: settings.profile.timezone,
      })
    : false;

  const saveProfile = async () => {
    if (!settings) {
      return;
    }

    try {
      setSavingKey("profile");
      setFeedbackMessage("");
      const updated = await apiRequest<UserSettingsResponse>({
        path: "/settings/me/profile",
        method: "PUT",
        body: JSON.stringify({
          full_name: String(profileDraft.full_name ?? ""),
          preferred_display_name: String(profileDraft.preferred_display_name ?? ""),
          timezone: String(profileDraft.timezone ?? settings.profile.timezone ?? "Europe/Amsterdam"),
        }),
      });

      setSettings(updated);
      setProfileDraft({
        full_name: updated.profile.full_name,
        email: updated.profile.email,
        preferred_display_name: updated.profile.preferred_display_name,
        timezone: updated.profile.timezone,
      });
      setSession({
        userId: userId ?? 0,
        email,
        role,
        name: updated.profile.preferred_display_name || updated.profile.full_name,
      });
      setFeedbackMessage("Profile saved.");
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSavingKey("");
    }
  };

  const shellContent = () => {
    if (isLoading) {
      return (
        <div className="rounded-[24px] border border-[#3c494c] bg-[#122131] px-7 py-8 text-sm text-[#bbc9cd]">
          Loading settings...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="rounded-[24px] border border-[#51353d] bg-[#1c2027] px-7 py-8 text-sm text-[#ffb4ab]">
          {loadError}
        </div>
      );
    }

    if (!settings) {
      return null;
    }

    return (
        <section className="min-h-[640px] overflow-hidden rounded-xl border border-[#3c494c] bg-[#122131]">
          <div className="flex flex-col gap-4 border-b border-[#3c494c] bg-[#1c2b3c] px-10 py-7 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-1 text-[#8aebff]">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#d4e4fa]">Profile</h3>
              <p className="mt-1 max-w-2xl text-sm text-[#bbc9cd]">
                Change how your name appears in the dashboard and workspace header.
              </p>
            </div>
          </div>
          <Button
            onClick={() => void saveProfile()}
            loading={savingKey === "profile"}
            icon={Save}
            disabled={!profileDirty}
              className="rounded-lg px-6 py-3 text-base font-semibold text-[#001f25]"
            >
              Save profile
            </Button>
          </div>

          <div className="p-12 xl:p-14">
            <div className="grid grid-cols-1 gap-x-14 gap-y-12 xl:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[#859397]">Full name</span>
              <input
                type="text"
                value={String(profileDraft.full_name ?? "")}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, full_name: event.target.value }))
                }
                className="w-full rounded-lg border border-[#3c494c] bg-[#010f1f] px-5 py-4 text-[1.05rem] text-[#d4e4fa] outline-none transition focus:border-[#8aebff] focus:ring-1 focus:ring-[#8aebff]"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[#859397]">Email address</span>
              <input
                type="email"
                value={String(profileDraft.email ?? "")}
                readOnly
                className="w-full rounded-lg border border-[#3c494c] bg-[#010f1f] px-5 py-4 text-[1.05rem] text-[#d4e4fa] outline-none"
              />
            </label>

              <label className="space-y-2 xl:col-span-2">
                <span className="block text-sm font-semibold text-[#859397]">Name shown in dashboard</span>
                <input
                  type="text"
                  value={String(profileDraft.preferred_display_name ?? "")}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      preferred_display_name: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#3c494c] bg-[#010f1f] px-5 py-4 text-[1.05rem] text-[#d4e4fa] outline-none transition focus:border-[#8aebff] focus:ring-1 focus:ring-[#8aebff]"
                />
              </label>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 xl:grid-cols-1">
            {metaCard("Role", settings.profile.role)}
          </div>
        </div>
      </section>
    );
  };

  return (
    <DashboardShell>
      <div className="min-h-[calc(100vh-10rem)]">
        <div className="mx-auto max-w-[1700px] px-10 py-8 xl:px-14">
          <div className="mb-14">
            <span className="font-[var(--font-jetbrains-mono)] text-[10px] uppercase tracking-widest text-[#8aebff]">Workspace</span>
            <h1 className="mt-3 font-[var(--font-hanken-grotesk)] text-[44px] font-semibold leading-[1.1] text-[#d4e4fa]">
              Settings
            </h1>
            <p className="mt-3 max-w-5xl text-[1.2rem] leading-9 text-[#bbc9cd]">
              Update your profile name and choose how your name appears in the dashboard.
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            {shellContent()}

            {feedbackMessage ? (
              <div className="rounded-[16px] border border-[#3c494c] bg-[#122131] px-5 py-4 text-sm text-[#d4e4fa]">
                {feedbackMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="-mx-6 -mb-6 mt-12 border-t border-[#3c494c] bg-[#010f1f] px-6 py-6 lg:-mx-8 xl:-mx-10">
        <div className="mx-auto flex max-w-[1520px] flex-col items-center justify-between gap-4 px-8 md:flex-row xl:px-12">
          <p className="text-sm text-[#bbc9cd]">© 2024 Talent Genie AI. All rights reserved.</p>
          <div className="flex flex-wrap gap-6 text-sm text-[#bbc9cd]">
            <a href="#" className="underline decoration-[#2fd9f4]/30 underline-offset-4 transition hover:text-[#8aebff]">
              Privacy Policy
            </a>
            <a href="#" className="underline decoration-[#2fd9f4]/30 underline-offset-4 transition hover:text-[#8aebff]">
              Terms of Service
            </a>
            <a href="#" className="underline decoration-[#2fd9f4]/30 underline-offset-4 transition hover:text-[#8aebff]">
              Security
            </a>
            <a href="#" className="underline decoration-[#2fd9f4]/30 underline-offset-4 transition hover:text-[#8aebff]">
              Cookie Settings
            </a>
          </div>
        </div>
      </footer>
    </DashboardShell>
  );
}
