// vite.config.ts
import { defineConfig } from "vite";
import { tanstackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
var vite_config_default = defineConfig({
  plugins: [
    tanstackRouterVite(),
    react()
  ]
});
export {
  vite_config_default as default
};
