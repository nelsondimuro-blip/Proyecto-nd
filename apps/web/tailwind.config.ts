import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tn: {
          DEFAULT: "#0a3d62",
          accent: "#f6b93b",
          dark: "#0c2461",
          muted: "#dff9fb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
