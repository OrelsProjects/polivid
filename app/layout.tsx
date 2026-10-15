import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "PoliVid: short videos from a prompt",
    template: "%s · PoliVid",
  },
  description:
    "Turn any idea into a polished short video with animated scenes, charts, and captions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full scroll-smooth antialiased`}
    >
      <Script
        defer
        data-website-id="dfid_1vlMBEXIHOZhFZfLKp7Zf"
        data-domain="polivid.ai"
        src="https://datafa.st/js/script.js"
      ></Script>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
