import { LandingNavbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { AIShowcaseSection } from "./ai-showcase-section";
import { AboutSection } from "./about-section";
import { StatsSection } from "./stats-section";
import { TestimonialsSection } from "./testimonials-section";
import { PricingSection } from "./pricing-section";
import { FAQSection } from "./faq-section";
import { LandingFooter } from "./footer";
import { FloatingWhatsApp } from "./floating-whatsapp";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-cyan-100 selection:text-cyan-900">
      <LandingNavbar />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <AIShowcaseSection />
      <AboutSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <LandingFooter />
      <FloatingWhatsApp />
    </div>
  );
}
