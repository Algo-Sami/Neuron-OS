/**
 * Neuron OS Motion Tokens
 * 
 * Establishes consistent, premium motion timing, easing curves, and stagger
 * values across the entire landing page. Tailored for a clean, light, intelligent SaaS identity.
 */

export const motion = {
  /**
   * Duration tokens (in seconds)
   */
  duration: {
    instant: 0,
    micro: 0.15,     // Micro-interactions (hover, active feedback)
    fast: 0.3,       // Quick UI transitions (dropdowns, tabs, accordions)
    normal: 0.6,     // Component & card entrances
    moderate: 0.8,   // Section headings & narrative text
    slow: 1.2,       // Hero reveals & prominent focal elements
    cinematic: 1.8,  // Full-scene ambient transitions & CountUp numbers
  },

  /**
   * Easing curve tokens (GSAP easing strings)
   */
  ease: {
    standard: "power3.out",    // Default for most UI entrances (natural deceleration)
    smooth: "power2.out",      // Gentle for cards, images, and subtle text
    bold: "power4.out",        // High-impact for hero headlines & mask reveals
    spring: "back.out(1.7)",   // Expressive for badges, chips, and icons
    exit: "power2.in",         // Content exiting the viewport
    scrub: "none",             // Scroll-tied animations (scrub handles velocity)
  },

  /**
   * Stagger tokens (in seconds)
   */
  stagger: {
    tight: 0.04,   // Character or dense item stagger
    normal: 0.08,  // Standard grid cards (e.g. Features 4x2 grid)
    relaxed: 0.12, // Section problem/solution rows & steps
    loose: 0.18,   // Hero elements & primary narrative steps
  },

  /**
   * Standardized reusable transition presets (GPU-friendly transform + opacity)
   */
  transitions: {
    fadeUp: {
      from: { opacity: 0, y: 32 },
      to: { opacity: 1, y: 0 },
    },
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    scaleUp: {
      from: { opacity: 0, scale: 0.94 },
      to: { opacity: 1, scale: 1 },
    },
    clipUp: {
      from: { clipPath: "inset(100% 0% 0% 0%)", y: 20 },
      to: { clipPath: "inset(0% 0% 0% 0%)", y: 0 },
    },
  },
} as const;

export type MotionDuration = typeof motion.duration;
export type MotionEase = typeof motion.ease;
export type MotionStagger = typeof motion.stagger;
