import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { App as CapacitorApp } from "@capacitor/app";

import { getRouter } from "./router";
import { isNative } from "./lib/nativeIO";
import "./styles.css";

const router = getRouter();

// Registro de tipos para que useNavigate/Link etc. conozcan las rutas.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Conecta el botón/gesto físico de "regresar" de Android con la navegación
// interna de la app (TanStack Router). Sin esto, Android cierra la app entera
// en vez de regresar a la pantalla anterior dentro de la SPA.
if (isNative()) {
  CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });
}

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
