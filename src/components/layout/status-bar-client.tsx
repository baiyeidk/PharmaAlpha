"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

interface Props {
  email: string;
  initials: string;
}

export function StatusBarClient({ email }: Props) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const user = email?.split("@")[0] || "operator";

  return (
    <header className="flex h-8 items-center justify-between border-b border-[var(--nf-border-invisible)] bg-[var(--nf-bg-surface)] px-4 font-mono text-[10px] tracking-[0.08em]">
      <div className="flex items-center gap-3 text-[var(--nf-text-tertiary)] uppercase">
        <span className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="PA"
            width={16}
            height={16}
            priority
            className="h-4 w-4 rounded-[2px] object-cover"
          />
          <span className="nf-text-primary font-semibold">PHARMAALPHA</span>
        </span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span>v1.0.0</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span className="nf-text-success">SYS_OK</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span>UPLINK · STABLE</span>
      </div>

      <div className="flex items-center gap-3 text-[var(--nf-text-tertiary)] uppercase">
        <span>{user}@pha</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span className="tabular-nums nf-text-secondary">{time}</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span>UTC</span>
      </div>
    </header>
  );
}
