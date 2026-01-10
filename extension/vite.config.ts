import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const browser = process.env.BROWSER || "chrome";
  const validBrowsers = ["chrome", "edge", "firefox"];

  if (!validBrowsers.includes(browser)) {
    throw new Error(
      `Invalid BROWSER env: ${browser}. Must be one of: ${validBrowsers.join(
        ", "
      )}`
    );
  }

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: `browsers/${browser}/manifest.json`, dest: "." },
          { src: "public/icons/*", dest: "icons" },
          { src: "src/popup/index.html", dest: "popup" },
          { src: "src/popup/styles/popup.css", dest: "popup" },
        ],
      }),
    ],

    // Use relative paths for browser extension compatibility
    base: "./",

    build: {
      outDir: `build/${browser}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          "popup/index": resolve(__dirname, "src/popup/index.tsx"),
          "background/index": resolve(__dirname, "src/background/index.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },

    define: {
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development"
      ),
      "process.env.BROWSER": JSON.stringify(browser),
    },
  };
});
