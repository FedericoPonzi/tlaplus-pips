import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  // Clean up any previously registered service worker (from the COEP experiment)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
  }, []);

  return <Component {...pageProps} />;
}
