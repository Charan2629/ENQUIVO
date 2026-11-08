/**
 * ENQUIVO Brand Design Tokens
 *
 * Signature Awwwards-inspired luxury real estate color palette:
 * - Deep Ocean (#102F43): Brand primary, dominant dark anchor, authoritative headers
 * - Jade Teal (#13A99A): Vibrant accent, interactive actions, live status, CTAs
 * - Champagne Gold (#D6B56D): Subtle luxury, timeline anchors, verified fact badges
 * - Pale Aqua (#E7F4F4): Delicate tint surfaces, AI bubble fills, table highlights
 * - Porcelain (#F7F8F4): Clean, luminous surfaces for buyer-facing experiences
 * - Dark Blue-Green (#183442): Secondary dark elevation, card depths, sidebar footers
 */

export const PALETTE = {
  deepOcean: "#102F43",
  deepOceanDark: "#0B2231",
  deepOceanMuted: "#1E4760",
  jadeTeal: "#13A99A",
  jadeTealDark: "#0D7A6F",
  jadeTealLight: "#38C2B4",
  champagneGold: "#D6B56D",
  champagneGoldLight: "#E8D3A0",
  champagneGoldDark: "#B8964E",
  paleAqua: "#E7F4F4",
  paleAquaLight: "#F2F9F9",
  paleAquaDark: "#D1EDED",
  porcelain: "#F7F8F4",
  porcelainWarm: "#F2F3EE",
  darkBlueGreen: "#183442",
  darkBlueGreenSurface: "#1F4152",
} as const;

export const THEME_SHADOWS = {
  subtle: "0 1px 2px 0 rgba(16, 47, 67, 0.05)",
  card: "0 4px 20px -2px rgba(16, 47, 67, 0.08)",
  hover: "0 12px 30px -4px rgba(16, 47, 67, 0.12)",
  floating: "0 20px 40px -8px rgba(16, 47, 67, 0.20)",
  goldGlow: "0 0 25px rgba(214, 181, 109, 0.25)",
  tealGlow: "0 0 25px rgba(19, 169, 154, 0.25)",
} as const;
