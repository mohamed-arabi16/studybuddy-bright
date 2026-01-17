import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { LanguageProvider } from "./contexts/LanguageContext";

// Render app first, then initialize Sentry (deferred)
createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);

// Defer Sentry initialization after first paint for better FCP
if (import.meta.env.VITE_SENTRY_DSN) {
  const initSentry = () => {
    import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.browserTracingIntegration(),
          // Defer replay to reduce initial bundle impact
        ],
        // Reduced sample rates for performance
        tracesSampleRate: 0.05,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
      });
    });
  };

  // Use requestIdleCallback if available, otherwise setTimeout
  if ("requestIdleCallback" in window) {
    (window as Window).requestIdleCallback(initSentry, { timeout: 3000 });
  } else {
    setTimeout(initSentry, 2000);
  }
}
