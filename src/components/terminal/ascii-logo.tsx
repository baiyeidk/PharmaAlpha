"use client";

import { cn } from "@/lib/utils";

const LOGO_SM = `
 ╔═══╗ ╔╗  ╔╗╔═══╗
 ║╔═╗║ ║║  ║║║╔═╗║
 ║╚═╝║ ║╚══╝║║║ ║║
 ║╔══╝ ║╔══╗║║╚═╝║
 ║║    ║║  ║║║╔═╗║
 ╚╝    ╚╝  ╚╝╚╝ ╚╝`.trimStart();

const LOGO_MD = `
 ╔═══════╗  ╔╗            ╔═══════╗  ╔╗
 ║╔═════╗║  ║║            ║╔═════╗║  ║║
 ║╚═════╝║  ║╚═══╗╔══╗   ║╚═════╝║  ║║  ╔══╗╔══╗╔══╗
 ║╔══════╝  ║╔══╗║╚╗╔╝   ║╔══════╝  ║║  ║╔╗║║╔╗║╚╗╔╝
 ║║         ║║  ║║ ║║    ║║         ║╚═╗║╚╝║║╚╝║ ║║
 ╚╝         ╚╝  ╚╝ ╚╝    ╚╝         ╚══╝╚══╝╚══╝ ╚╝`.trimStart();

const LOGO_LG = `
 ██████╗ ██╗  ██╗ █████╗ ██████╗ ███╗   ███╗ █████╗
 ██╔══██╗██║  ██║██╔══██╗██╔══██╗████╗ ████║██╔══██╗
 ██████╔╝███████║███████║██████╔╝██╔████╔██║███████║
 ██╔═══╝ ██╔══██║██╔══██║██╔══██╗██║╚██╔╝██║██╔══██║
 ██║     ██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║██║  ██║
 ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝

      █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗
     ██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗
     ███████║██║     ██████╔╝███████║███████║
     ██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║
     ██║  ██║███████╗██║     ██║  ██║██║  ██║
     ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝`.trimStart();

const sizes = {
  sm: { art: LOGO_SM, fontSize: "text-[6px] leading-[8px]" },
  md: { art: LOGO_MD, fontSize: "text-[8px] leading-[10px]" },
  lg: { art: LOGO_LG, fontSize: "text-[10px] leading-[12px]" },
} as const;

interface AsciiLogoProps {
  size?: keyof typeof sizes;
  className?: string;
}

export function AsciiLogo({ size = "md", className }: AsciiLogoProps) {
  const { art, fontSize } = sizes[size];
  return (
    <pre
      className={cn(
        "font-mono text-term-green glow-normal select-none whitespace-pre",
        fontSize,
        className,
      )}
      aria-label="PharmaAlpha"
    >
      {art}
    </pre>
  );
}
