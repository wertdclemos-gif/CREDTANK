if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=2026-08-18.2");
  });
}

function updateYear() {
  const el = document.querySelector("[data-year]");
  if (el) {
    el.textContent = new Date().getFullYear();
  }
}

document.addEventListener("DOMContentLoaded", updateYear);





