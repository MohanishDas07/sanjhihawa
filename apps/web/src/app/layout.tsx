import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "SanjhiHawa - Clean Air Assistant & Breath Budget Engine",
  description: "Navigate severe winter smog with personalized low-exposure routines, indoor hacks, and sustainable alternatives.",
  keywords: ["air quality", "AQI", "PM2.5", "Breath Budget", "Delhi smog", "Ghaziabad", "indoor air", "HEPA purifier"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-paper text-ink selection:bg-ink selection:text-paper font-sans text-base">
        <a href="#main-content" className="skip-to-content font-mono text-xs uppercase tracking-wider">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
