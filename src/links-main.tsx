import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LinksPage from "./LinksPage.tsx";
import "./links.css";
import "./analytics.js";

createRoot(document.getElementById("root")!).render(<StrictMode><LinksPage /></StrictMode>);
