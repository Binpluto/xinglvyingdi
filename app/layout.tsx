import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星旅营地｜游戏化人生管理",
  description: "与同伴共赴群星：邮箱登录、云端成长、五人小组与世界排行。",
  icons: { icon: "/favicon.svg" },
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
      <body>{children}</body>
    </html>
  );
}
