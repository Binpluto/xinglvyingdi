import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星旅营地｜游戏化人生管理",
  description: "把目标化作主线，把每一天变成值得期待的冒险。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "星旅营地｜游戏化人生管理",
    description: "把愿望写进今日的冒险",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "星旅营地" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "星旅营地｜游戏化人生管理",
    description: "把愿望写进今日的冒险",
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
