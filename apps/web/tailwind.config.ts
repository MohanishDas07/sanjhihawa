import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Locked SAANS Field-Instrument Editorial Tokens
        paper: {
          DEFAULT: "#F3EFE6",
          dark: "#141517",
        },
        surface: {
          DEFAULT: "#FBF8F1",
          card: "#FFFFFF",
          dark: "#1D1E22",
          cardDark: "#24262B",
        },
        ink: {
          DEFAULT: "#17181A",
          muted: "#4A4D52",
          light: "#F3EFE6",
          lightMuted: "#9EA2A8",
        },
        rule: {
          DEFAULT: "#CFC8B8",
          dark: "#33363D",
        },
        // CPCB NAQI Strict Color Scale
        aqi: {
          good: "#1E8E4E",
          satisfactory: "#7FB539",
          moderate: "#F2C200",
          poor: "#F28C28",
          veryPoor: "#D7263D",
          severe: "#7A0F2E",
        },
      },
      fontFamily: {
        serif: [
          "Plus Jakarta Sans",
          "var(--font-sans)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        sans: [
          "Plus Jakarta Sans",
          "var(--font-sans)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "var(--font-mono)",
          "SF Mono",
          "Fira Code",
          "Roboto Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        devanagari: [
          "Tiro Devanagari Hindi",
          "var(--font-devanagari)",
          "Noto Serif Devanagari",
          "Devanagari MT",
          "Mangal",
          "serif",
        ],
      },
      fontSize: {
        "3xs": ["0.6875rem", { lineHeight: "0.9375rem", letterSpacing: "0.04em" }], // 11px
        "2xs": ["0.75rem", { lineHeight: "1.0625rem", letterSpacing: "0.03em" }],   // 12px
        "xs": ["0.8125rem", { lineHeight: "1.1875rem" }],                           // 13px
        "sm": ["0.9375rem", { lineHeight: "1.4375rem" }],                           // 15px
        "base": ["1.0625rem", { lineHeight: "1.6875rem" }],                         // 17px
        "lg": ["1.1875rem", { lineHeight: "1.75rem" }],                             // 19px
        "xl": ["1.375rem", { lineHeight: "1.875rem" }],                             // 22px
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }],                           // 26px
        "3xl": ["2rem", { lineHeight: "2.375rem" }],                                // 32px
        "4xl": ["2.5rem", { lineHeight: "2.875rem" }],                              // 40px
        "5xl": ["3.25rem", { lineHeight: "3.5rem" }],                               // 52px
        "6xl": ["4.25rem", { lineHeight: "4.5rem" }],                               // 68px
        "7xl": ["5.5rem", { lineHeight: "5.75rem" }],                               // 88px
      },
      borderWidth: {
        hairline: "1px",
      },
    },
  },
  plugins: [],
};

export default config;
