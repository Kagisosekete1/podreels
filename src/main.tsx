import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeApp } from "./lib/nativeApp";

initNativeApp();

createRoot(document.getElementById("root")!).render(<App />);
