import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#090c10",
        ink: "#f5f9ff",
        muted: "#8fa2b5",
        line: "rgba(255,255,255,0.08)",
        panel: "#141a20",
        brand: {
          50: "#eefcff",
          100: "#d8f8ff",
          200: "#b5f2ff",
          300: "#8beaff",
          400: "#63e7ff",
          500: "#42cbff",
          600: "#289fe3",
          700: "#207bb0",
          800: "#1a5f86",
          900: "#154867"
        }
      },
      boxShadow: {
        soft: "0 26px 70px rgba(0, 0, 0, 0.28)",
        card: "0 18px 42px rgba(0, 0, 0, 0.24)"
      },
      borderRadius: {
        xl2: "1.5rem"
      },
      fontFamily: {
        sans: ["var(--font-manrope)"],
        mono: ["var(--font-ibm-plex-mono)"]
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at top left, rgba(99,231,255,0.14), transparent 30%), linear-gradient(180deg, rgba(20,26,32,0.98), rgba(13,17,22,0.95))"
      }
    }
  },
  plugins: []
};

export default config;
