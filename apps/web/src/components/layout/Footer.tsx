import React from "react";
import Link from "next/link";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-surface border-t hairline border-rule mt-16 text-sm font-sans text-ink-muted">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: System Purpose */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-serif text-2xl font-bold text-ink block">
              सांझी हवा / SANJHIHAWA Air Quality Decision Assistant
            </span>
            <p className="text-sm leading-relaxed text-ink/80">
              Designed for Indian households navigating severe winter smog. Built on strict principles:
              the LLM never computes numbers; a pure deterministic engine calculates inhaled doses,
              indoor mass balances, and schedule optimizations.
            </p>
            <div className="font-mono text-xs p-3 bg-paper border border-rule text-ink leading-relaxed">
              <strong>Cardinal Rule:</strong> All numbers are computed deterministically. The LLM only narrates and personalizes tool outputs.
            </div>
          </div>

          {/* Col 2: Navigation & Evidence */}
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink font-bold block">
              System Pages
            </span>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:underline">Today's Air & Skyline</Link></li>
              <li><Link href="/onboarding" className="hover:underline">Household Profile Setup</Link></li>
              <li><Link href="/your-day" className="hover:underline">Your Day Timeline & Budget</Link></li>
              <li><Link href="/simulate" className="hover:underline">What-If Intervention Simulator</Link></li>
              <li><Link href="/chat" className="hover:underline">Ask SanjhiHawa (AI Assistant)</Link></li>
              <li><Link href="/lab" className="hover:underline">Home Air Lab & Purifier Sizing</Link></li>
              <li><Link href="/community" className="hover:underline">Community & School Advisory Card</Link></li>
              <li><Link href="/how-saans-works" className="hover:underline">Formulas & Privacy Model</Link></li>
            </ul>
          </div>

          {/* Col 3: Privacy & Disclaimers */}
          <div className="space-y-2 text-sm">
            <span className="font-mono text-xs uppercase tracking-wider text-ink font-bold block">
              Privacy & Standards
            </span>
            <p className="leading-relaxed">
              <strong>Privacy by Design:</strong> No server accounts. Household data lives exclusively in your browser localStorage.
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              <strong>Heuristic Note:</strong> Cigarette-equivalents (PM2.5 / 22 µg/m³) is a communication rule of thumb (Berkeley Earth, 2015) and NOT medical fact.
            </p>
          </div>
        </div>

        <div className="border-t hairline border-rule pt-4 flex flex-col sm:flex-row justify-between items-center text-xs md:text-sm font-mono text-ink-muted gap-2">
          <div>© 2026 SanjhiHawa Team. Atmospheric data modelled by CAMS via Open-Meteo. CPCB NAQI Standards.</div>
          <div>WCAG 2.2 AA Accessible • Production Ready</div>
        </div>
      </div>
    </footer>
  );
};
