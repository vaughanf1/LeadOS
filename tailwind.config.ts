import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0A84FF",
          50: "#E8F2FF",
          100: "#D1E5FF",
          200: "#A3CBFF",
          300: "#75B1FF",
          400: "#4798FF",
          500: "#0A84FF",
          600: "#0066CC",
          700: "#004D99",
          800: "#003366",
          900: "#001A33",
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
