// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";
var app_config_default = defineConfig({
  tsr: {
    appDirectory: "src"
  },
  server: {
    preset: "node-server"
  }
});
export {
  app_config_default as default
};
