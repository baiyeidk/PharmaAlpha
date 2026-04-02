"use client";

interface Props {
  email: string;
  initials: string;
}

export function StatusBarClient({ email, initials }: Props) {
  return (
    <header className="flex h-9 items-center justify-between px-5 text-[12px] text-foreground/50">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-foreground/70">PharmaAlpha</span>
        <span className="text-foreground/20">|</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#28C840]" />
          <span>系统正常</span>
        </div>
        <span className="text-foreground/20">|</span>
        <span>
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span>{email}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-scrub/10 text-[10px] font-bold text-scrub">
          {initials}
        </div>
      </div>
    </header>
  );
}
