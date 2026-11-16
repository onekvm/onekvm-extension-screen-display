import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./web/display/plugin.ts", import.meta.url)),
      name: "OneKVMScreenDisplayPage",
      formats: ["iife"],
      fileName: () => "display-page.js",
    },
    outDir: "web/dist",
    rollupOptions: {
      external: ["vue", "naive-ui"],
      output: {
        globals: {
          vue: "OneKVMPluginUI.v1.vue",
          "naive-ui": "OneKVMPluginUI.v1.naive",
        },
      },
    },
  },
});
