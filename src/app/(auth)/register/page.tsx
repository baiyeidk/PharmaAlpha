"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        setError(data.error || "注册失败");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0eee9] via-[#eae8e4] to-[#ede9e3]" />

      <div className="relative w-full max-w-[420px] px-6">
        <div className="rounded-2xl overflow-hidden bg-[#f6f5f4]/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] border border-black/[0.05]">
          {/* macOS title bar */}
          <div className="flex h-10 items-center px-4 gap-3 border-b border-black/[0.05] bg-[#eceae8]/50">
            <div className="flex items-center gap-[7px]">
              <div className="h-3 w-3 rounded-full bg-[#EC6A5E] border border-[#D1503F]/40" />
              <div className="h-3 w-3 rounded-full bg-[#F4BF4F] border border-[#D49E28]/40" />
              <div className="h-3 w-3 rounded-full bg-[#61C554] border border-[#4CA93B]/40" />
            </div>
            <span className="text-[13px] text-foreground/50 font-medium">账号注册</span>
          </div>

          <div className="p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">创建账号</h1>
              <p className="mt-1 text-sm text-foreground/50">注册后即可使用投资分析平台</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl bg-vitals-red/5 border border-vitals-red/20 px-4 py-3 text-sm text-vitals-red">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-foreground/60">
                  用户名
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="请输入您的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl bg-black/[0.02] border-black/[0.06] text-base h-11 focus:border-scrub/50 focus-visible:ring-scrub/20"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground/60">
                  邮箱账号
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl bg-black/[0.02] border-black/[0.06] text-base h-11 focus:border-scrub/50 focus-visible:ring-scrub/20"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground/60">
                  设置密码
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少 8 个字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="rounded-xl bg-black/[0.02] border-black/[0.06] text-base h-11 focus:border-scrub/50 focus-visible:ring-scrub/20"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-scrub text-white hover:bg-scrub/90 text-sm font-semibold rounded-xl h-11"
                disabled={loading}
              >
                {loading ? "正在注册…" : "立即注册"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-foreground/50">
              已有账号？{" "}
              <Link href="/login" className="text-scrub hover:text-scrub/80 transition-colors font-medium">
                前往登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
