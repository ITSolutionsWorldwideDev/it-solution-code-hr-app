import { Building2, CircleUserRound } from "lucide-react";

import type { EmployeeHierarchyNode } from "@/lib/recruitment-types";
import { cn } from "@/lib/utils";

type OrganogramTreeProps = {
  nodes: EmployeeHierarchyNode[];
};

const accentMap = {
  Executive: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
  IT: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
  Sales: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
  People: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
  Finance: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
  default: {
    badge: "bg-[#6a717a] text-white",
    role: "text-[#6a717a]",
    icon: "text-[#6a717a]",
  },
} as const;

function getAccent(department: string) {
  return accentMap[department as keyof typeof accentMap] ?? accentMap.default;
}

function OrganogramCard({
  node,
  compact = false,
}: {
  node: EmployeeHierarchyNode;
  compact?: boolean;
}) {
  const accent = getAccent(node.department);

  return (
    <div
      className={cn(
        "relative mx-auto flex flex-col items-center rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] px-3 pb-3 pt-4 shadow-[0_14px_32px_rgba(0,0,0,0.24)]",
        compact ? "w-[170px]" : "w-[190px]"
      )}
    >
      <div className="absolute -top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0d1116] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
        <CircleUserRound className={cn("h-5.5 w-5.5", accent.icon)} strokeWidth={1.75} />
      </div>

      <div className={cn("mt-3 w-[calc(100%+0.8rem)] px-2 py-2 text-center", accent.badge)}>
        <p
          className={cn(
            "truncate font-semibold uppercase tracking-[0.03em]",
            compact ? "text-[0.72rem]" : "text-[0.8rem]"
          )}
        >
          {node.fullName}
        </p>
      </div>

      <p
        className={cn(
          "mt-3 text-center font-semibold uppercase tracking-[0.03em] leading-4",
          compact ? "text-[0.6rem]" : "text-[0.66rem]",
          accent.role
        )}
      >
        {node.role}
      </p>

      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/6 px-2 py-1 text-[0.56rem] font-medium text-[#9cb0c1]">
        <Building2 className="h-2.5 w-2.5" />
        {node.department}
      </div>
    </div>
  );
}

function OrganogramNode({
  node,
  level = 0,
}: {
  node: EmployeeHierarchyNode;
  level?: number;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <OrganogramCard node={node} compact={level > 0} />

      {hasChildren ? (
        <>
          <div className="h-5 w-px bg-[#577286]" />
          <div className="organogram-children-wrap">
            <div className="organogram-horizontal-line" />
            <div className="organogram-children-row">
              {node.children.map((child) => (
                <div key={child.id} className="organogram-child">
                  <div className="h-10 w-px bg-[#577286]" />
                  <OrganogramNode node={child} level={level + 1} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OrganogramTree({ nodes }: OrganogramTreeProps) {
  return (
    <div className="overflow-x-auto pb-6">
      <div className="organogram-canvas min-w-[980px] rounded-[30px] border border-white/10 px-6 py-10 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="flex min-w-max justify-center gap-8">
          {nodes.map((node) => (
            <OrganogramNode key={node.id} node={node} />
          ))}
        </div>
      </div>
    </div>
  );
}
