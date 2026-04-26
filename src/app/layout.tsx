import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PharmaAlpha — Data · Insight · Decision",
  description: "Retro-terminal AI agent platform for pharmaceutical intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${interSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const key = 'pharmaalpha-theme';
                const saved = localStorage.getItem(key);
                const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            })();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
