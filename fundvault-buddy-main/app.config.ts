import { defineConfig } from "@tanstack/start/config";
export default defineConfig({
  tsr: {
    appDirectory: "src",
  },
  server: {
    preset: "vercel",
  },
});