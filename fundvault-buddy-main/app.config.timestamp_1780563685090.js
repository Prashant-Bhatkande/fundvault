// app.config.ts
import { createApp } from "vinxi";
import { tanstackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
var app_config_default = createApp({
  routers: [
    {
      name: "public",
      type: "static",
      dir: "./public",
      base: "/"
    },
    {
      name: "client",
      type: "client",
      handler: "./src/start.tsx",
      target: "browser",
      plugins: () => [tanstackRouterVite(), react()]
    },
    {
      name: "server",
      type: "http",
      handler: "./src/server.ts",
      target: "server"
    }
  ]
});
export {
  app_config_default as default
};
