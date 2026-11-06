export {};

declare global {
  interface Window {
    dataLayer: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Shared by the public entry points only; the management app is not tracked.
const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID || "G-1WBT99GLQY").trim();
const googleAdsId = "AW-18554751020";
const publicHost = ["ravastudio3d.com.br", "www.ravastudio3d.com.br"].includes(window.location.hostname);

if (import.meta.env.PROD && publicHost && /^G-[A-Z0-9]+$/.test(measurementId)) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
  window.gtag("config", googleAdsId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}
