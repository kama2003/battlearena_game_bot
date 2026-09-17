import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F7F5",
        surface: "#FFFFFF",
        "surface-alt": "#F1F1EF",
        primary: "#161719",
        secondary: "#707174",
        border: "#E8E8E5",
        "btn-primary": "#17191A",
        "btn-primary-fg": "#FFFFFF",
        accent: "#D9A441",
        "accent-strong": "#C99137",
      },
      borderRadius: {
        card: "24px",
        "card-sm": "20px",
        button: "20px",
        "button-sm": "18px",
        block: "28px",
        chip: "14px",
      },
      fontFamily: {
        sans: ["Onest", "Manrope", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
