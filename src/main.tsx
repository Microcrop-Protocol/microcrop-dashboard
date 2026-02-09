import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnv } from "./lib/env";

validateEnv();

window.addEventListener("unhandledrejection", (event) => {
  console.error("[MicroCrop] Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
