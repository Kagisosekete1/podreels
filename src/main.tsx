import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePush } from "./lib/push";

createRoot(document.getElementById("root")!).render(<App />);

// Initialise native push (OneSignal) when running inside a Capacitor shell.
initNativePush();
