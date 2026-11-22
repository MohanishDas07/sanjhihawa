"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Saans Web Application Error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-surface border-2 border-ink space-y-5 text-center animate-fadeIn">
      <div className="space-y-1">
        <span className="font-mono text-xs uppercase tracking-wider text-amber-800 font-bold block">
          Application Notice
        </span>
        <h1 className="font-sans text-2xl font-bold text-ink tracking-tight">
          Unable to Load Interface
        </h1>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        An unexpected error occurred while rendering this view. Your stored profile data in your browser is safe.
      </p>

      <div className="flex justify-center gap-3 pt-2 font-mono text-xs">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-ink text-paper font-bold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-rule bg-paper text-ink hover:bg-surface transition-colors"
        >
          Return to Today's Air →
        </Link>
      </div>
    </div>
  );
}
