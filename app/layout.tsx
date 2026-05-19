import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "タイムカード",
  description: "スタッフの出勤・退店と支給額を記録するタイムカードアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f1f5f9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full`}>
      <body
        className={`${notoSansJp.className} min-h-full bg-slate-100 text-slate-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
