"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        setError(data.error || "登录凭证无效");
        setLoading(false);
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("系统异常，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 bg-surgical-grid opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_400px_300px_at_center,oklch(0.42_0.14_160_/_6%),transparent)]" />

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-10">
        <svg className="w-full h-16" viewBox="0 0 1200 60" preserveAspectRatio="none" fill="none">
          <path
            d="M0,30 L350,30 L380,30 L400,8 L420,52 L440,20 L460,30 L1200,28"
            stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" strokeLinecap="round" className="ecg-line"
          />
        </svg>
      </div>

      <div className="relative w-full max-w-md px-6">
        <div className="border border-border bg-white p-8 rounded-sm">
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-px w-8 bg-scrub/40" />
              <span className="font-mono text-base tracking-[0.2em] text-scrub">身份认证</span>
              <div className="h-px w-8 bg-scrub/40" />
            </div>
            <div className="text-center">
              <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">用户登录</h1>
              <p className="mt-1 text-lg text-muted-foreground">登录后进入投资分析工作台</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="border border-vitals-red/30 bg-vitals-red/5 px-4 py-3 text-base text-vitals-red font-mono rounded-sm">
                ⚠ {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-base font-medium text-muted-foreground">
                邮箱账号
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-sm bg-background border-border text-lg md:text-lg py-3 h-auto min-h-0 focus:border-scrub/50 focus-visible:ring-scrub/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-base font-medium text-muted-foreground">
                登录密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-sm bg-background border-border text-lg md:text-lg py-3 h-auto min-h-0 focus:border-scrub/50 focus-visible:ring-scrub/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-scrub text-marrow hover:bg-scrub/90 text-lg font-semibold tracking-wider rounded-sm"
              disabled={loading}
            >
              {loading ? "正在登录…" : "立即登录"}
            </Button>
          </form>

          <p className="mt-6 text-center text-lg text-muted-foreground">
            还没有账号？{" "}
            <Link href="/register" className="text-scrub hover:text-scrub/80 transition-colors font-medium">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
