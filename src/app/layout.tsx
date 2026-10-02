import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const reem = Reem_Kufi({
  subsets: ["arabic"],
  weight: ["700"],
  variable: "--font-reem",
  display: "swap",
});

// Every page reads the catalog from the database at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} | كتب مجانية للقراءة والتحميل`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "ar_IQ", type: "website" },
  formatDetection: { telephone: false },
  // Google Search Console ownership check (the "HTML tag" method).
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#1b140e" },
  ],
};

// Applies the saved (or system) theme before first paint to avoid a flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("arnooba:theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from src/proxy.ts; inline scripts without it are blocked.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning className={`${plex.variable} ${reem.variable}`}>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
