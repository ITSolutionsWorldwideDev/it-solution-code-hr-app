import { CheckCircle2, CircleSlash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import type { HiringRequestRecord } from "@/lib/recruitment-types";

type HiringRequestListProps = {
  items: HiringRequestRecord[];
};

const toneMap = {
  pending: "blue",
  approved: "green",
  rejected: "red",
} as const;

export function HiringRequestList({ items }: HiringRequestListProps) {
  return (
    <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,17,38,0.98)_0%,rgba(16,24,47,0.94)_100%)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.26)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-[1.4rem] font-semibold text-white">Hiring Requests</h2>
        <p className="text-sm text-[#95a2c7]">
          Temporary mock approval controls until backend workflow actions are connected.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-[22px] border border-white/8 bg-[#111932] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[1.08rem] font-semibold text-white">{item.jobTitle}</h3>
                  <StatusPill status={item.status} tone={toneMap[item.status]} />
                </div>
                <p className="text-sm text-[#95a2c7]">
                  {item.department} · {item.budget} · Requested by {item.requestedBy}
                </p>
                <p className="text-sm leading-6 text-[#c4d1ea]">{item.requirements}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" icon={CheckCircle2}>
                  Approve
                </Button>
                <Button type="button" variant="secondary" icon={CircleSlash2}>
                  Reject
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
