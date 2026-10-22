import type { Config } from "tailwindcss";

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
        primary: {
          50: "#FDE7F3",
          100: "#FBC4E2",
          200: "#F78EC5",
          300: "#F358A8",
          400: "#EF2D93",
          500: "#E91E8C",
          600: "#D11A7E",
          700: "#B0156A",
          800: "#8F1156",
          900: "#6E0D42",
        },
        secondary: {
          50: "#F3E8FF",
          100: "#E0CCFF",
          200: "#C49DFF",
          300: "#A86EFF",
          400: "#8C3FFF",
          500: "#7C3AED",
          600: "#6D28D9",
          700: "#5B21B6",
          800: "#4C1D95",
          900: "#3B0764",
        },
      },
    },
  },
  plugins: [],
};

export default config;
