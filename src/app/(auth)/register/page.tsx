"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="absolute inset-0 bg-dot-grid opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.95_0.01_195)_0%,transparent_70%)]" />

      <div className="relative w-full max-w-sm px-6">
        <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-pa-cyan/10 to-transparent blur-sm" />
        <div className="relative rounded-xl border border-border bg-white shadow-sm p-8">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-pa-cyan/20 bg-pa-cyan/5">
              <Activity className="h-6 w-6 text-pa-cyan" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold tracking-tight">Create Account</h1>
              <p className="mt-1 text-xs text-muted-foreground">Get started with PharmaAlpha</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-pa-red/20 bg-pa-red/5 px-3 py-2 text-xs text-pa-red">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-border focus:border-pa-cyan/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border focus:border-pa-cyan/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-border focus:border-pa-cyan/50"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-pa-cyan text-white hover:bg-pa-cyan/90 font-medium"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-pa-cyan hover:text-pa-cyan/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
