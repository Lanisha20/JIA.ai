/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
      extend: {
        colors: {
          night: "#1b0f28",
          plum: "#2b1842",
          dusk: "#462b6d",
          panel: "#241b36",
          gold: "#f4c471",
          amber: "#e58e33",
          lilac: "#9e7cfd",
          aqua: "#7ad3f3"
        },
        boxShadow: {
          glow: "0 0 35px rgba(244,196,113,0.10)",
          glowSoft: "0 0 20px rgba(158,124,253,0.35)"
        },
        fontFamily: {
          fancy: ["Cinzel", "serif"],
          ui: ["Inter", "system-ui", "sans-serif"]
        }
      }
    },
    plugins: []
  };
  