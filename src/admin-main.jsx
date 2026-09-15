import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp.jsx";
import "./admin.css";
import "./admin-fields.css";
import "./consignacao.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
