import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

function csvManifestPlugin() {
  const virtualModuleId = "virtual:csv-manifest";
  const resolvedId = "\0" + virtualModuleId;
  const fishDir = path.resolve("public/data/Fish");
  const shopDir = path.resolve("public/data/Shop");

  function buildModule() {
    const fish = fs
      .readdirSync(fishDir)
      .filter((f) => f.endsWith(".csv"))
      .sort();
    const shop = fs
      .readdirSync(shopDir)
      .filter((f) => f.endsWith(".csv"))
      .sort();
    return (
      `export const FISH_CSVS = ${JSON.stringify(fish)};\n` +
      `export const SHOP_CSVS = ${JSON.stringify(shop)};\n`
    );
  }

  return {
    name: "csv-manifest",
    resolveId(id) {
      if (id === virtualModuleId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return buildModule();
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(fishDir) || file.startsWith(shopDir)) {
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), csvManifestPlugin()],
  server: {
    open: true,
    port: 8000,
  },
});
