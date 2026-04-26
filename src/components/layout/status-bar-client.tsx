"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { MoonStar, Sun } from "lucide-react";

interface Props {
  email: string;
  initials: string;
}

export function StatusBarClient({ email }: Props) {
  const [time, setTime] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }
    setTheme("dark");
  }, []);

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

  const toggleTheme = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("pharmaalpha-theme", next);
    } catch {
      // no-op when storage is unavailable
    }
  };

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
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex h-5 items-center gap-1.5 rounded-[3px] border border-[var(--nf-border-invisible)] bg-[var(--nf-bg-elevated)] px-2 text-[10px] tracking-[0.08em] text-[var(--nf-text-secondary)] transition-[border-color,color,box-shadow] duration-200 hover:border-[var(--nf-accent)] hover:text-[var(--nf-accent)] hover:shadow-[var(--nf-glow-sm)]"
        >
          {theme === "dark" ? <Sun className="h-3 w-3" /> : <MoonStar className="h-3 w-3" />}
          <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
        </button>
        <span>{user}@pha</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span className="tabular-nums nf-text-secondary">{time}</span>
        <span className="text-[var(--nf-border-visible)]">│</span>
        <span>UTC</span>
      </div>
    </header>
  );
}
