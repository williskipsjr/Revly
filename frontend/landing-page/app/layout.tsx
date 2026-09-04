import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revly · Revenue Recovery Intelligence",
  description:
    "An AI-assisted, bounded revenue recovery decision platform. Detects revenue at risk, estimates recoverability, ranks interventions with ERV, and enforces deterministic policy before execution.",
  keywords: [
    "Revenue Recovery",
    "Razorpay AI Buildathon",
    "Track 03",
    "Payment Recovery",
    "Expected Recovery Value",
    "Bounded Autonomy",
    "Financial Infrastructure",
  ],
  authors: [{ name: "Revly Systems" }],
  icons: {
    icon: "/revly.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas text-ink antialiased selection:bg-revly-blue/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}

