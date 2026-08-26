import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星旅营地｜游戏化人生管理",
  description: "与同伴共赴群星：邮箱登录、云端成长、五人小组与世界排行。",
  applicationName: "星旅营地",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "星旅营地",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "星旅营地｜游戏化人生管理",
    description: "五人小组 · 云端成长 · 世界排行",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "星旅营地" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "星旅营地｜游戏化人生管理",
    description: "与同伴共赴群星",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <script src="/pwa-register.js" defer />
      </body>
    </html>
  );
}
