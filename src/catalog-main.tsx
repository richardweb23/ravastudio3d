import React from "react";
import { createRoot } from "react-dom/client";
import CatalogPage from "./CatalogPage.tsx";
import "./catalogo.css";
import "./analytics.js";
createRoot(document.getElementById("root")!).render(<React.StrictMode><CatalogPage /></React.StrictMode>);
