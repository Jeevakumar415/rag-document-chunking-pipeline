/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0b0f17",
        panel: "#111827",
        "panel-raised": "#161f30",
        electric: "#2563eb",
        cyan: "#06b6d4",
      },
      boxShadow: {
        glow: "0 0 32px rgba(59, 130, 246, 0.16)",
      },
    },
  },
  plugins: [],
};
