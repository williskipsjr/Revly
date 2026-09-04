import React from "react";

interface RevlyLogoProps {
  variant?: "full" | "mark-only" | "compact";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function RevlyLogo({
  variant = "full",
  className = "",
  size = "md",
}: RevlyLogoProps) {
  // Dimension mappings
  const imgHeights = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12",
  };

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {/* Crisp vector representation of the Revly dynamic 'R' glyph */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-8 h-8"}
          >
            <defs>
              <linearGradient id="revlyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D2FF" />
                <stop offset="48%" stopColor="#2563FF" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
              <linearGradient id="revlyGradFold" x1="10%" y1="20%" x2="90%" y2="90%">
                <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#4338CA" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            {/* Stem & Folded R */}
            <path
              d="M10 8H26C31.5 8 35 11.5 35 16C35 20.2 31.8 23.5 27 24L36 36H28L20.5 25H16V36H10V8Z"
              fill="url(#revlyGrad1)"
            />
            {/* Inner loop cutout */}
            <path
              d="M16 13.5V20H25.5C27.8 20 29.5 18.5 29.5 16.75C29.5 15 27.8 13.5 25.5 13.5H16Z"
              fill="#050505"
            />
            {/* Fold shadow */}
            <path
              d="M16 20L22 25H16V20Z"
              fill="url(#revlyGradFold)"
            />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-sans font-semibold tracking-[-0.03em] text-ink text-[16px] leading-tight">
            REVLY
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
            Intelligence
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Real brand asset image with crisp rendering */}
      <img
        src="/revly-2.png"
        alt="Revly - Revenue Recovery Intelligence"
        className={`${imgHeights[size]} w-auto object-contain brightness-110 contrast-105`}
      />
    </div>
  );
}

