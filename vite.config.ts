import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/gamedev-04-breakout/" : "/",
  server: { port: 5176, open: true },
  build: { target: "es2020" },
}));
