import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { THEME_BOOT_SCRIPT } from "@/lib/hooks/use-theme";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  // Absolute URLs are required for social previews, and a static export has no
  // request to infer the origin from.
  metadataBase: new URL("https://martin-k-m.github.io/meridian/"),
  title: "meridian — meeting times across timezones",
  description: "Pick a meeting time that works across timezones, with everyone's working hours and daylight saving handled for you.",
  applicationName: "meridian",
  openGraph: {
    title: "meridian",
    description: "Meeting times across timezones, in everyone's own clock.",
    url: "https://martin-k-m.github.io/meridian/",
    siteName: "meridian",
    images: [{ url: "https://raw.githubusercontent.com/martin-k-m/meridian/main/docs/screenshot.png", width: 2760, height: 1400, alt: "meridian in use" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "meridian",
    description: "Meeting times across timezones, in everyone's own clock.",
    images: ["https://raw.githubusercontent.com/martin-k-m/meridian/main/docs/screenshot.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161f" },
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
