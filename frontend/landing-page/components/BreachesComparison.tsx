"use client";

import React, { useState } from "react";

export default function BreachesComparison() {
  const [selectedCase, setSelectedCase] = useState(0);

  const cases = [
    {
      merchant: "SaaS Enterprise",
      year: "HDFC API",
      amount: "₹8,499.00",
      code: "504_GATEWAY_TIMEOUT",
      summary: "A transient issuer timeout hit a subscription renewal, and conventional retry scripts bombarded the gateway until the card was blocked.",
      conventionalSteps: [
        "A sudden network timeout occurred during HDFC card authentication.",
        "The merchant's default cron script executed 3 immediate retries within 90 seconds.",
        "HDFC anti-fraud velocity filter triggered on the fourth rapid attempt, permanently blocking the card.",
        "The customer received 4 SMS alerts, assumed their card was compromised, and cancelled the subscription.",
      ],
      revlySteps: [
        "Gateway 504 was diagnosed immediately as a transient issuer outage with 0.94 confidence.",
        "The ERV engine suppressed immediate retries and scheduled an optimal retry window (+14m) with cooldown enforcement.",
        "A single idempotent retry was executed after the bank network stabilized, capturing the funds with zero customer friction.",
      ],
      tagHeuristics: ["T1090 · Transient gateway timeout", "w12 · Issuer network blip", "P(success | delayed_retry) = 89%"],
      quote: "The payment still succeeds. What changes is the timing behind it, and what leaves is zero customer friction.",
      notHelp: "Revly does not fix bank infrastructure outages. It changes when and how the transaction re-enters the gateway.",
    },
    {
      merchant: "Direct-to-Consumer",
      year: "UPI AutoPay",
      amount: "₹1,250.00",
      code: "51_INSUFFICIENT_FUNDS",
      summary: "A soft decline occurred 2 days before payday, and naive daily retries annoyed the user into canceling their plan.",
      conventionalSteps: [
        "The customer had insufficient account balance during end-of-month billing.",
        "The subscription billing engine retried every 24 hours for 3 consecutive days.",
        "The customer received repeated push notifications and was charged penalty fees by their bank.",
        "Customer churned permanently and filed a complaint on social media.",
      ],
      revlySteps: [
        "Context enrichment identified end-of-month pay cycle patterns with high lifetime loyalty score.",
        "The ERV optimizer recognized that immediate retries carried negative expected value due to customer friction.",
        "Revly automatically dispatched a polite WhatsApp payment link allowing alternate payment or payment on payday.",
      ],
      tagHeuristics: ["T1042 · Liquidity gap pattern", "w10 · End-of-month sensitivity", "ERV(Payment Link) = +₹925"],
      quote: "Understanding customer timing recovers value where blind automation creates hostility.",
      notHelp: "Revly does not grant credit or alter account balances. It matches communication to the customer's financial rhythm.",
    },
    {
      merchant: "Fintech Platform",
      year: "e-NACH",
      amount: "₹14,800.00",
      code: "MANDATE_EXPIRED",
      summary: "A recurring bank mandate expired, and naive retry automation repeatedly triggered failed mandate penalty fees.",
      conventionalSteps: [
        "The underlying e-NACH mandate reached its expiration date unnoticed by the billing platform.",
        "The automated system retried the mandate 3 times, incurring ₹50 penalty fees per attempt.",
        "Account was flagged as delinquent despite the customer having full intention to pay.",
        "Merchant lost ₹14,800 in recurring revenue and ₹150 in useless gateway fees.",
      ],
      revlySteps: [
        "Revly recognized the terminal error code: retry probability was mathematically 0.0%.",
        "Deterministic policy immediately blocked all automated retry actions to protect merchant economics.",
        "Revly generated a seamless mandate update flow with one-click UPI Autopay re-authorization.",
      ],
      tagHeuristics: ["T1016 · Mandate lifecycle termination", "w14 · Zero retry probability", "Policy: BLOCK_RETRIES"],
      quote: "Knowing when not to retry is the foundation of intelligent revenue recovery.",
      notHelp: "Revly does not extend expired bank mandates automatically. It prevents wasted retry costs and routes to re-authorization.",
    },
    {
      merchant: "B2B Logistics",
      year: "Corporate Card",
      amount: "₹95,000.00",
      code: "HIGH_VALUE_THRESHOLD",
      summary: "A high-value enterprise invoice failed 3DS verification, and a generic bot sent a generic collection email.",
      conventionalSteps: [
        "A ₹95,000 invoice payment failed due to corporate card OTP authentication timeout.",
        "An automated template email was dispatched threatening service suspension within 48 hours.",
        "The enterprise procurement manager was offended by the harsh tone and delayed all quarterly receivables.",
        "Cash flow was frozen for 45 days while account managers apologized.",
      ],
      revlySteps: [
        "The transaction amount exceeded the merchant's deterministic autonomous ceiling (₹50,000).",
        "Deterministic policy routed the case to HUMAN_REVIEW, blocking all automated customer communications.",
        "An executive summary was delivered to the enterprise account director with context and customized payment link.",
      ],
      tagHeuristics: ["T1552 · Amount ceiling exceeded", "w16 · Enterprise VIP tier", "Verdict: ESCALATE_TO_OPERATOR"],
      quote: "Strategic enterprise revenue deserves white-glove judgment, not robotic automation.",
      notHelp: "Revly does not replace relationship managers on key accounts. It protects enterprise relationships from naive automation.",
    },
  ];

  const current = cases[selectedCase];

  return (
    <section id="cases" className="flex flex-col items-center px-gutter pb-[100px] lg:pb-[180px]">
      <div className="relative w-full max-w-[1920px] overflow-hidden rounded-card bg-plot px-gutter py-[80px] lg:py-[120px] border border-white/[0.08]">
        <div className="relative mx-auto flex w-full max-w-[1445px] flex-col gap-[60px]">
          {/* Header */}
          <div className="flex flex-col gap-[30px] lg:flex-row lg:items-end lg:justify-between">
            <h2 className="t-h2 max-w-[18ch] text-white">
              Four failures, and how Revly resolved them.
            </h2>
            <p className="t-body max-w-[52ch] text-white/50">
              Each of these was an at-risk transaction doing observable things in production.
              The left column is the conventional failure pattern. The right is what this decision
              architecture is built to do against the same event.
            </p>
          </div>

          {/* 4 Case Selector Buttons */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {cases.map((c, idx) => {
              const isSelected = idx === selectedCase;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCase(idx)}
                  className={`flex flex-col gap-3 rounded-inner p-4 text-left ring-1 ring-inset transition-all duration-300 ${
                    isSelected
                      ? "bg-white/[0.09] ring-white/30 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                      : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`t-h3 !text-[19px] ${isSelected ? "text-white" : "text-white/60"}`}>
                      {c.merchant}
                    </span>
                    <span className="font-mono text-[12px] text-white/35 font-semibold">
                      {c.amount}
                    </span>
                  </div>
                  <span className="font-mono text-[11.5px] leading-[1.5] text-white/40">
                    {c.code}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Deep Case Comparison Breakdown */}
          <div className="flex flex-col gap-6">
            <p className="t-h3 max-w-[46ch] text-white">
              {current.summary}
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left Column: What happened */}
              <div className="flex flex-col gap-5 rounded-card bg-white/[0.03] p-6 ring-1 ring-inset ring-white/[0.07]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                    What happened
                  </span>
                  <span className="font-mono text-[11.5px] text-white/30">
                    naive automation
                  </span>
                </div>
                <ol className="flex flex-col gap-3">
                  {current.conventionalSteps.map((s, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="mt-[3px] shrink-0 font-mono text-[11.5px] text-white/25">
                        0{idx + 1}
                      </span>
                      <span className="t-micro leading-[1.6] text-white/55 normal-case font-sans">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Right Column: What Revly is built to do */}
              <div className="flex flex-col gap-5 rounded-card bg-white/[0.06] p-6 ring-1 ring-inset ring-white/25">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-lime font-semibold">
                    What Revly is built to do
                  </span>
                  <span className="font-mono text-[11.5px] text-white/45">
                    bounded intelligence
                  </span>
                </div>
                <ol className="flex flex-col gap-3">
                  {current.revlySteps.map((s, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="mt-[3px] shrink-0 font-mono text-[11.5px] text-lime">
                        0{idx + 1}
                      </span>
                      <span className="t-micro leading-[1.6] text-white/80 normal-case font-sans">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-1.5 border-t border-white/[0.08] pt-4">
                  {current.tagHeuristics.map((h, idx) => (
                    <span
                      key={idx}
                      className="rounded-chip bg-white/[0.06] px-2.5 py-1.5 font-mono text-[11px] text-white/70"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Quote & Limitation */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
              <blockquote className="flex flex-col justify-center rounded-card bg-lime/[0.07] p-6 ring-1 ring-inset ring-lime/25">
                <p className="t-h3 !text-[20px] !leading-[1.4] text-lime">
                  &ldquo;{current.quote}&rdquo;
                </p>
              </blockquote>
              <div className="flex flex-col gap-3 rounded-card bg-white/[0.03] p-6 ring-1 ring-inset ring-white/[0.07]">
                <span className="font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-white/55">
                  Where it would not have helped
                </span>
                <p className="t-micro leading-[1.6] text-white/50 normal-case font-sans">
                  {current.notHelp}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

