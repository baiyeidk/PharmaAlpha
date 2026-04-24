"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("System error. Retry later.");
      setLoading(false);
    }
  }

  return (
    <div className="nf-page nf-scroll min-h-screen overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1400px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">AUTH / 01</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">IDENTITY_REQUIRED</span>
            </div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="PharmaAlpha"
                width={36}
                height={36}
                priority
                className="h-9 w-9 rounded-[4px] border border-[var(--nf-border-invisible)] object-cover"
              />
              <h1 className="nf-h1">Authenticate</h1>
            </div>
            <p className="nf-sub max-w-2xl">
              Enter credentials to access the console. All sessions are logged with full PEC reasoning trace.
            </p>
          </div>
          <Link href="/" className="nf-btn">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </header>

        <section className="nf-card p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Session Credentials</h2>
            </div>
            <span className="nf-nano">01</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 rounded-[4px] border border-[rgba(217,106,94,0.3)] bg-[rgba(217,106,94,0.06)] px-3 py-2 text-[11px] font-mono text-[var(--nf-danger)] tracking-[0.03em]">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  <span className="font-semibold uppercase tracking-[0.1em]">ERR</span> · {error}
                </span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="email" className="nf-label">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="operator@pharma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="nf-input"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="nf-label">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="nf-input"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--nf-border-invisible)] pt-4">
              <span className="nf-nano nf-text-tertiary">
                NO_ACCOUNT?{" "}
                <Link
                  href="/register"
                  className="nf-text-accent tracking-[0.1em] hover:text-[var(--nf-accent-hover)] transition-colors"
                >
                  REGISTER →
                </Link>
              </span>
              <button
                type="submit"
                className="nf-btn nf-btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[var(--nf-accent)]" />
                    Authenticating
                  </span>
                ) : (
                  <>
                    Authenticate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--nf-border-invisible)] pt-4 nf-nano">
          <span>© 2026 · PHARMAALPHA</span>
          <span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--nf-success)]" />
              TLS · 1.3
            </span>
            <span>SESSION · ANON</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
