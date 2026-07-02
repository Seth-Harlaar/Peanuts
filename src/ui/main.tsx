import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ResolverProvider } from "./context";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ResolverProvider>
        <App />
      </ResolverProvider>
    </HashRouter>
  </StrictMode>,
);
