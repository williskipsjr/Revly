"use client";

import React, { useState, useEffect } from "react";
import RevlyLogo from "./RevlyLogo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Overview", href: "#" },
    { name: "The Surface", href: "#surface" },
    { name: "Live Engine", href: "#watch" },
    { name: "Architecture", href: "#architecture" },
    { name: "Continuity", href: "#continuity" },
    { name: "Case Studies", href: "#cases" },
    { name: "Invariants", href: "#invariants" },
    { name: "Intelligence", href: "#intelligence" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-500">
      <div
        className={`mx-auto flex items-center justify-between gap-4 px-gutter rounded-pill border transition-[max-width,margin,padding,background-color,box-shadow,border-color,backdrop-filter] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] my-0 max-w-[1920px] ${
          scrolled
            ? "bg-[#0A0A0C]/90 border-white/10 py-[14px] shadow-2xl backdrop-blur-md"
            : "bg-white/0 border-transparent py-[26px] shadow-none backdrop-blur-none"
        }`}
      >
        {/* Brand identity */}
        <a className="flex h-10 shrink-0 items-center gap-2.5 text-ink group focus:outline-none" href="#">
          <RevlyLogo variant="compact" size="md" />
        </a>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-2 lg:flex">
          {navLinks.map((link, idx) => (
            <a
              key={link.name}
              href={link.href}
              className={`t-ui whitespace-nowrap rounded-pill px-4 py-2 transition-colors duration-300 ${
                idx === 0
                  ? "bg-surface text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Right CTA */}
        <div className="flex shrink-0 items-center gap-3">
          <a
            className="group relative items-center justify-center rounded-pill t-ui whitespace-nowrap transition-[transform,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 bg-ink-raised text-white py-3 pl-5 pr-[46px] hidden sm:inline-flex border border-white/10 hover:border-white/20"
            href="#watch"
          >
            <span>Watch a recovery</span>
            <span className="absolute right-1.5 grid size-[30px] place-items-center rounded-full overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 bg-white text-ink">
              <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="size-2.5">
                <path
                  d="M1.5 8.5 8.5 1.5M8.5 1.5H3.2M8.5 1.5v5.3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="grid size-11 place-items-center rounded-full bg-ink-raised text-white lg:hidden border border-white/10"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute inset-x-0 top-0 h-0.5 rounded bg-current transition-transform duration-300 ${
                  mobileMenuOpen ? "rotate-45 top-1.5" : ""
                }`}
              />
              <span
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded bg-current transition-transform duration-300 ${
                  mobileMenuOpen ? "-rotate-45 bottom-1" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mx-4 mt-2 rounded-card bg-[#0D0D0E] border border-white/10 p-5 shadow-2xl">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="t-ui px-4 py-2.5 text-muted hover:text-ink hover:bg-white/[0.04] rounded-pill transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
