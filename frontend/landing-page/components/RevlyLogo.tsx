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
  // Dimension mappings for responsive navbar and components
  const imgHeights = {
    sm: "h-6",
    md: "h-7 sm:h-8",
    lg: "h-10",
  };

  if (variant === "mark-only") {
    return (
      <img
        src="/revly-icon-white@4x.png"
        alt="Revly Icon"
        className={`${imgHeights[size]} w-auto object-contain shrink-0 select-none ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/revly-logo-white@4x.png"
        alt="Revly"
        className={`${imgHeights[size]} w-auto object-contain shrink-0 select-none`}
      />
    </div>
  );
}
