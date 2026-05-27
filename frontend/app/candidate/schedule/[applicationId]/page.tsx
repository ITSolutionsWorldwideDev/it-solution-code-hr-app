import Image from "next/image";

import { PublicCandidateSchedule } from "@/components/recruitment/public-candidate-schedule";

type CandidateSchedulePageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function CandidateSchedulePage({ params }: CandidateSchedulePageProps) {
  const { applicationId } = await params;

  return (
    <main className="min-h-screen bg-[#0b0d10] px-5 py-5 text-white md:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(88,122,164,0.12),transparent_28%),linear-gradient(180deg,#111315_0%,#0d0f12_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <header className="border-b border-white/8 px-6 py-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#8cabff]/25 bg-[#8cabff]/10">
                <Image
                  src="/ITSW Neon.png"
                  alt="IT Solutions Worldwide"
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">IT Solutions Worldwide</p>
                <p className="text-xs text-[#92a2b2]">Interview scheduling</p>
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-8 md:px-8 md:py-10">
          <PublicCandidateSchedule applicationId={applicationId} />
        </div>
      </div>
    </main>
  );
}
