import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnv } from "./lib/env";
import { reloadOnceForStaleChunk } from "./lib/chunk-reload";

validateEnv();

// Vite fires this when a preloaded code-split chunk fails to load — typically a
// stale chunk after a deploy. Reload once to pick up the new build.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[MicroCrop] Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
