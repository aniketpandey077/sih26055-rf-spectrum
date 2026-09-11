/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070b13",
        panel: "#0c1322",
        panelBorder: "#182438",
        panelHover: "#1f2f49",
        accent: "#00f2ff",
        accentGlow: "rgba(0, 242, 255, 0.35)",
        accentDim: "#0284c7",
        cyberGreen: "#10b981",
        cyberAmber: "#f59e0b",
        cyberRed: "#f43f5e",
        cyberPurple: "#8b5cf6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        cyber: "0 0 20px rgba(0, 242, 255, 0.15)",
        cyberGlow: "0 0 30px rgba(0, 242, 255, 0.35)",
        radar: "0 0 25px rgba(16, 185, 129, 0.2)",
        alert: "0 0 25px rgba(244, 63, 94, 0.3)",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
