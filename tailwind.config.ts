import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One Stop 4 Equity Release — primary navy (#263850)
        brand: {
          DEFAULT: "#263850",
          50: "#F2F4F7",
          100: "#E3E8EF",
          200: "#C7D0DE",
          300: "#97A6BC",
          400: "#5C7491",
          500: "#3A5273",
          600: "#263850",
          700: "#1F2E42",
          800: "#182331",
          900: "#0F1722",
        },
        // OS4ER accent — amber/orange (#FD9B0E)
        accent: {
          DEFAULT: "#FD9B0E",
          50: "#FFF6E9",
          100: "#FFEACB",
          200: "#FED28E",
          300: "#FEBE5C",
          400: "#FDAB36",
          500: "#FD9B0E",
          600: "#E08605",
          700: "#B56C07",
          800: "#8A530A",
          900: "#5C370A",
        },
        ink: {
          DEFAULT: "#0A0A0A",
          muted: "#6B7280",
          soft: "#9CA3AF",
        },
        canvas: {
          DEFAULT: "#FAFAFA",
          card: "#FFFFFF",
          subtle: "#F4F4F5",
        },
        line: "#E5E7EB",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: [
          "Montserrat",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        base: ["16px", "24px"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        soft: "0 4px 14px rgba(16, 24, 40, 0.06)",
        pop: "0 12px 30px rgba(16, 24, 40, 0.10)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
    },
  },
  plugins: [],
};

export default config;
