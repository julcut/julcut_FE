import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

const roboto = Roboto({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "축지법",
  description: "AI 기반 축제 대기열 배치 설계 및 대기시간 안내 플랫폼",
};

/*
  노치가 있는 기기에서 상단바가 상태표시줄에 가려졌다. safe-area 값을 쓰려면 화면을
  가장자리까지 쓰겠다고 먼저 선언해야 한다.
*/
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
