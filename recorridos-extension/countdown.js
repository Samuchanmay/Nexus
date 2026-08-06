// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — Contador de preparación pre-captura
//  ══════════════════════════════════════════════════════════════════
//  Se inyecta bajo demanda (chrome.scripting.executeScript). Define
//  window.__emetRecorridosCountdown(seconds) que devuelve una Promise
//  que resuelve a true (capturar) o false (cancelado):
//
//    - Cuenta atrás visual en el centro de la página (Enter captura ya).
//    - Enter      → resolver true de inmediato (saltar el contador).
//    - Esc        → resolver false (cancelar la captura).
//    - Botones    → "Capturar ahora" / "Cancelar" (equivalentes).
//
//  chrome.scripting.executeScript resuelve el valor de la Promise en
//  results[0].result, así que el popup y el service worker la usan
//  directo. Inspirado en Fable (Apache 2.0) y Supademo.
// ══════════════════════════════════════════════════════════════════

(function () {
  if (window.__emetRecorridosCountdown) return;

  let active = null;

  window.__emetRecorridosCountdown = function (seconds = 3) {
    if (active) return active.promise;

    let resolveDone;
    const promise = new Promise((resolve) => {
      resolveDone = resolve;
    });
    active = { promise, resolve: resolveDone };

    let remaining = Math.max(1, Math.round(seconds));
    let finished = false;

    const overlay = document.createElement("div");
    overlay.id = "emet-countdown-overlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:1000001",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:20px",
      "background:rgba(0,0,0,0.72)",
      "backdrop-filter:blur(6px)",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "color:#fff",
      "text-align:center",
      "padding:24px",
    ].join(";");

    overlay.innerHTML =
      '<div style="width:96px;height:96px;border-radius:50%;border:4px solid #3b82f6;display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(59,130,246,0.6);">' +
      '<span id="emet-cd-num" style="font-size:48px;font-weight:700;line-height:1;">' +
      remaining +
      "</span></div>" +
      '<p style="font-size:16px;font-weight:500;margin:0;">Preparando captura…</p>' +
      '<div style="display:flex;gap:12px;">' +
      '<button id="emet-cd-now" style="background:#10b981;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Capturar ahora</button>' +
      '<button id="emet-cd-cancel" style="background:#2e2e2e;color:#fff;border:1px solid #404040;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Cancelar</button>' +
      "</div>" +
      '<p style="font-size:12px;color:#b0b0b0;margin:0;">Enter para capturar ya · Esc para cancelar</p>';

    document.body.appendChild(overlay);

    const numEl = overlay.querySelector("#emet-cd-num");

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        numEl.textContent = "0";
        finish(true);
        return;
      }
      numEl.textContent = String(remaining);
    }, 1000);

    function finish(result) {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      const a = active;
      active = null;
      a.resolve(result);
    }

    function onKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    }

    document.addEventListener("keydown", onKey, true);
    overlay.querySelector("#emet-cd-now").addEventListener("click", () => finish(true));
    overlay.querySelector("#emet-cd-cancel").addEventListener("click", () => finish(false));

    return promise;
  };
})();
