import "./globals.css";

import type { Metadata } from "next";
import localFont from "next/font/local";

const ppSupplyMono = localFont({
  src: "../../public/font/PPSupplyMono-Regular.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Err Day",
  description: "A daily thought journal with generated daily art.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ppSupplyMono.variable} font-mono uppercase antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
