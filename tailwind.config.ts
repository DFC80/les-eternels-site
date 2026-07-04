import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2fb",
          100: "#d6e0f3",
          200: "#aebee9",
          300: "#7f96d8",
          400: "#5572bf",
          500: "#36488f",
          600: "#283a78",
          700: "#1e2c5e",
          800: "#141f47",
          900: "#0a1330",
          950: "#050a1c",
        },
        silver: {
          100: "#f4f6f9",
          200: "#e2e7ee",
          300: "#c7d2e0",
          400: "#a3b1c6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        brand: ["var(--font-brand)"],
      },
      backgroundImage: {
        "radial-glow":
          "radial-gradient(circle at 50% 20%, rgba(86,114,191,0.35), transparent 60%)",
      },
    },
  },
  plugins: [],
};
export default config;
