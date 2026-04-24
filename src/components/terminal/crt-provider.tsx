"use client";

import { useEffect } from "react";

export function CRTProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("crt-active");
    return () => {
      document.body.classList.remove("crt-active");
    };
  }, []);

  return <>{children}</>;
}
