import { LandingNavbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { AIShowcaseSection } from "./ai-showcase-section";
import { AboutSection } from "./about-section";
import { StatsSection } from "./stats-section";
import { TestimonialsSection } from "./testimonials-section";
import { PricingSection } from "./pricing-section";
import { FAQSection } from "./faq-section";
import { ContactSection } from "./contact-section";
import { LandingFooter } from "./footer";
import { FloatingWhatsApp } from "./floating-whatsapp";

export function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#f8fafc] text-[#201f1e] overflow-x-hidden selection:bg-[#c7e0f4] selection:text-[#004578]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}
    >
      <LandingNavbar />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <AIShowcaseSection />
      <AboutSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <ContactSection />
      <LandingFooter />
      <FloatingWhatsApp />
    </div>
  );
}
