import React from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TechMarquee from "@/components/TechMarquee";
import RiskSurface from "@/components/RiskSurface";
import WatchItHappen from "@/components/WatchItHappen";
import WorldShiftSection from "@/components/WorldShiftSection";
import ContinuitySection from "@/components/ContinuitySection";
import SameContainerDifferentWorld from "@/components/SameContainerDifferentWorld";
import BreachesComparison from "@/components/BreachesComparison";
import ThreeMechanisms from "@/components/ThreeMechanisms";
import ShapeOfSystem from "@/components/ShapeOfSystem";
import CurveComparison from "@/components/CurveComparison";
import ConversionSequence from "@/components/ConversionSequence";
import RelocationFingerprints from "@/components/RelocationFingerprints";
import SecurityInvariants from "@/components/SecurityInvariants";
import SessionIntelligence from "@/components/SessionIntelligence";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink selection:bg-revly-cyan/25 selection:text-white">
      {/* 1. Floating Pill Header */}
      <Navbar />

      <main className="flex-1 flex flex-col">
        {/* 2. Hero: The payment gateway is never bypassed. The checkout survives. */}
        <Hero />

        {/* 3. Technology Partner Marquee */}
        <TechMarquee />

        {/* 4. Section 2: Recovery is a surface, not a switch. */}
        <RiskSurface />

        {/* 5. Section 3: Watch it happen (interactive PTY live replay) */}
        <WatchItHappen />

        {/* 6. Section 4: Revly bounds the decision instead (4-tab blueprint) */}
        <WorldShiftSection />

        {/* 7. Section 5: Continuity you can inspect */}
        <ContinuitySection />

        {/* 8. Section 6: Same checkout. Different economics. */}
        <SameContainerDifferentWorld />

        {/* 9. Section 7: Four failures, and how recovery resolved instead */}
        <BreachesComparison />

        {/* 10. Section 8: The three mechanisms */}
        <ThreeMechanisms />

        {/* 11. Section 9: The shape of the system */}
        <ShapeOfSystem />

        {/* 12. Section 10: Some failures never climb the curve (6 3D wireframe plots) */}
        <CurveComparison />

        {/* 13. Section 11: How conversion runs */}
        <ConversionSequence />

        {/* 14. Section 12: Blind retries destroy customer trust (VS comparison) */}
        <RelocationFingerprints />

        {/* 15. Section 13: Security invariants */}
        <SecurityInvariants />

        {/* 16. Section 14: Session intelligence (Failure tactics heatmap) */}
        <SessionIntelligence />
      </main>

      {/* 17. Section 15: Watch the revenue recover (CTA + Footer) */}
      <Footer />
    </div>
  );
}
