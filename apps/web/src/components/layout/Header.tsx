"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation, Language } from "@/lib/i18n";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { lang, setLanguage } = useTranslation();
  const [elderMode, setElderMode] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const savedElder = localStorage.getItem("saans_elder_mode") === "1";
    if (savedElder) {
      setElderMode(true);
      document.body.classList.add("elder-mode");
    }
  }, []);

  const handleLangChange = (newLang: Language) => {
    setLanguage(newLang);
  };

  const toggleElderMode = () => {
    const next = !elderMode;
    setElderMode(next);
    localStorage.setItem("saans_elder_mode", next ? "1" : "0");
    if (next) {
      document.body.classList.add("elder-mode");
    } else {
      document.body.classList.remove("elder-mode");
    }
  };

  const navLinks = [
    { href: "/", labelEn: "Today's Air", labelHi: "आज की हवा", labelMr: "आजची हवा" },
    { href: "/your-day", labelEn: "Your Day", labelHi: "दिनचर्या", labelMr: "दिनचर्या" },
    { href: "/simulate", labelEn: "What-If Simulator", labelHi: "सिमुलेटर", labelMr: "सिम्युलेटर" },
    { href: "/chat", labelEn: "Ask SanjhiHawa", labelHi: "सांझी हवा से पूछें", labelMr: "सांझी हवा विचारा" },
    { href: "/lab", labelEn: "Home Air Lab", labelHi: "होम एयर लैब", labelMr: "होम एअर लॅब" },
    { href: "/community", labelEn: "Community Card", labelHi: "समुदाय कार्ड", labelMr: "समुदाय कार्ड" },
    { href: "/how-saans-works", labelEn: "How It Works", labelHi: "पारदर्शिता", labelMr: "पारदर्शकता" },
  ];

  return (
    <header className="w-full bg-surface border-b hairline border-rule select-none">
      {/* Top Banner: Editorial Newspaper Masthead Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 border-b hairline border-rule flex items-center justify-between text-xs md:text-sm font-mono text-ink-muted">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-ink uppercase tracking-wider">SANJHIHAWA</span>
          <span>|</span>
          <span className="hidden sm:inline">Winter Smog & Clean Air Decision System</span>
          <span className="sm:hidden">Clean Air System</span>
          <span className="hidden lg:flex items-center space-x-1.5 pl-3 border-l hairline border-rule text-2xs md:text-xs font-mono text-emerald-800 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>DETERMINISTIC ENGINE ACTIVE</span>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Elder Mode Toggle */}
          <button
            onClick={toggleElderMode}
            aria-pressed={elderMode}
            className={`px-3 py-1 border text-xs md:text-sm font-sans transition-colors ${
              elderMode
                ? "bg-ink text-paper border-ink font-bold"
                : "bg-surface hover:bg-paper border-rule text-ink font-medium"
            }`}
            title="Toggle Elder Mode (Larger fonts & high contrast)"
          >
            A+ Elder Mode
          </button>

          {/* Language Switcher */}
          <div className="flex items-center border border-rule bg-surface overflow-hidden" role="group" aria-label="Language selection">
            <button
              type="button"
              onClick={() => handleLangChange("en")}
              aria-pressed={lang === "en"}
              className={`px-2.5 py-1 text-xs md:text-sm font-medium transition-colors ${
                lang === "en" ? "bg-ink text-paper font-bold" : "hover:bg-paper text-ink"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleLangChange("hi")}
              aria-pressed={lang === "hi"}
              className={`px-2.5 py-1 text-xs md:text-sm font-devanagari transition-colors ${
                lang === "hi" ? "bg-ink text-paper font-bold" : "hover:bg-paper text-ink"
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => handleLangChange("mr")}
              aria-pressed={lang === "mr"}
              className={`px-2.5 py-1 text-xs md:text-sm font-devanagari transition-colors ${
                lang === "mr" ? "bg-ink text-paper font-bold" : "hover:bg-paper text-ink"
              }`}
            >
              मराठी
            </button>
          </div>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <Link href="/" className="group flex items-baseline space-x-2.5">
          <span className="font-serif text-2xl md:text-4xl font-bold tracking-tight text-ink group-hover:opacity-90">
            सांझी हवा / SANJHIHAWA
          </span>
          <span className="font-mono text-2xs md:text-xs uppercase px-2 py-0.5 bg-paper border border-rule text-ink-muted font-medium">
            Field Unit
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 font-sans" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            const label = lang === "hi" ? link.labelHi : (lang === "mr" ? link.labelMr : link.labelEn);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 transition-all text-xs lg:text-sm font-sans font-medium rounded-sm ${
                  active
                    ? "bg-ink text-paper font-bold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-paper"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Hamburger */}
        <div className="md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            className="p-2 border border-rule bg-paper text-ink"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <nav className="md:hidden border-t hairline border-rule bg-paper px-4 py-3 space-y-2">
          {navLinks.map((link) => {
            const label = lang === "hi" ? link.labelHi : (lang === "mr" ? link.labelMr : link.labelEn);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block py-2 text-base ${
                  pathname === link.href ? "font-bold text-ink" : "text-ink-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
};
