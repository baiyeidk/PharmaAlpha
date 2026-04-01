"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Bot className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">PharmaAlpha</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          AI-powered Agent platform for pharmaceutical intelligence and analysis.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
          Sign in
        </Link>
        <Link
          href="/register"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
