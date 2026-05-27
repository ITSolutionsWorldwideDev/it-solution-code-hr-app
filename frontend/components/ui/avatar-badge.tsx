type AvatarBadgeProps = {
  initials: string;
};

export function AvatarBadge({ initials }: AvatarBadgeProps) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#86b7da] to-[#234d79] text-sm font-bold text-white shadow-sm">
      {initials}
    </div>
  );
}
