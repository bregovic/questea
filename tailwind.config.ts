import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          light: "#fbfaf9",
          DEFAULT: "#f0ebe1",
          dark: "#78716c",
        },
        coral: {
          light: "#fb923c",
          DEFAULT: "#ea580c",
          dark: "#c2410c",
        },
      },
    },
  },
  plugins: [],
};
export default config;
