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
        canvas: "#070b11",
        panel: "#10161f",
        line: "#223246",
        ink: "#f3f7fb",
        muted: "#90a2b5",
        accent: "#7aa2c7",
        accentStrong: "#a8c8e6",
      },
      boxShadow: {
        shell: "0 30px 90px rgba(0, 0, 0, 0.3)",
      },
      borderRadius: {
        shell: "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
