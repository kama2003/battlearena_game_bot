import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@battle/ui";
import "@battle/ui/styles/tokens.css";
import "./styles/global.css";
import { queryClient } from "./lib/queryClient";
import { initTelegramApp } from "./lib/telegram";
import { enableMocksIfRequested } from "./dev/enableMocks";
import { App } from "./App";

enableMocksIfRequested();
initTelegramApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
