import type { Config } from "tailwindcss";
import { designTokens } from "../shared/design-tokens";

const brand = designTokens.color;
const brandScale = {
  50: brand.brandWash,
  100: brand.brandSoft,
  200: "#E9D6DF",
  300: "#D8B7C5",
  400: brand.brandMark,
  500: brand.brandMid,
  600: "#853F5B",
  700: brand.brand,
  800: brand.brandStrong,
  900: "#4B1C30",
  950: "#2B111B",
};
const successScale = {
  50: designTokens.color.successSoft,
  100: "#D1E9DB",
  200: "#A6D3B8",
  300: "#7CBC95",
  400: "#4B936C",
  500: designTokens.color.success,
  600: "#145B40",
  700: "#0F4C35",
  800: "#0C3D2B",
  900: "#092F21",
};
const warningScale = {
  50: designTokens.color.warningSoft,
  100: "#FCE6AD",
  200: "#F6D47A",
  300: "#E8BC51",
  400: "#CC9824",
  500: designTokens.color.warning,
  600: "#6A4600",
  700: "#533700",
  800: "#3B2700",
  900: "#2A1B00",
};
const errorScale = {
  50: designTokens.color.errorSoft,
  100: "#F8D7D7",
  200: "#EBAEAE",
  300: "#D98282",
  400: "#BE5959",
  500: designTokens.color.error,
  600: "#872525",
  700: "#701D1D",
  800: "#581717",
  900: "#421111",
};
const infoScale = {
  50: designTokens.color.infoSoft,
  100: "#D4E2F0",
  200: "#ADC7E0",
  300: "#83A9CD",
  400: "#5A8AB9",
  500: designTokens.color.info,
  600: "#214A73",
  700: "#1A3E62",
  800: "#14324F",
  900: "#0E263C",
};

/**
 * Tailwind CSS configuration for M-Care web dashboard.
 * Custom brand colors: primary (pink) and secondary (purple).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: brandScale,
        secondary: brandScale,
        rose: brandScale,
        pink: brandScale,
        purple: brandScale,
        emerald: successScale,
        green: successScale,
        amber: warningScale,
        yellow: warningScale,
        red: errorScale,
        blue: infoScale,
        indigo: infoScale,
        brand,
        gray: {
          50: brand.canvas,
          100: "#F4EFF1",
          200: brand.divider,
          300: brand.border,
          400: brand.textPlaceholder,
          500: brand.textMuted,
          600: "#4B444A",
          700: "#373137",
          800: "#2E282D",
          900: brand.text,
          950: "#1D1A1D",
        },
      },
      fontSize: {
        xs: ["12px", { lineHeight: "18px" }],
        sm: ["14px", { lineHeight: "21px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "38px" }],
        "4xl": ["34px", { lineHeight: "42px" }],
      },
      borderRadius: {
        sm: `${designTokens.radius.sm}px`,
        DEFAULT: `${designTokens.radius.md}px`,
        md: `${designTokens.radius.md}px`,
        lg: `${designTokens.radius.lg}px`,
        xl: `${designTokens.radius.xl}px`,
        "2xl": `${designTokens.radius.xl}px`,
      },
    },
  },
  plugins: [],
};

export default config;
