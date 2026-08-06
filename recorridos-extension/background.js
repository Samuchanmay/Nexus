// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — Service worker (v4)
//  ══════════════════════════════════════════════════════════════════
//  Permite grabar sin tener el popup abierto, vía atajos globales:
//
//    Ctrl+Shift+E  → capturar la pantalla actual al recorrido en curso
//    Ctrl+Shift+R  → abrir el popup (para finalizar / revisar)
//
//  La grabación se guarda en chrome.storage.local bajo la clave
//  "recording" (el mismo modelo que usa popup.js), así que ambas
//  partes comparten estado sin acoplarse. Cuando el popup está abierto
//  se le notifica con un mensaje "recording-updated" para que se
//  refresque al vuelo.
// ══════════════════════════════════════════════════════════════════

async function getStoredRecording() {
  const { recording } = await chrome.storage.local.get("recording");
  return recording || null;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function notifyPopup(payload) {
  try {
    chrome.runtime.sendMessage({ type: "recording-updated", ...payload }).catch(() => {});
  } catch {
    /* popup cerrado: no hay a quién notificar, es normal */
  }
}

// ── Captura idéntica a popup.js, más scroll y viewport ─────────────
async function captureCurrentScreen() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error("No se encontró una pestaña activa.");
  if (!/^https?:/i.test(tab.url || "")) {
    throw new Error("Esta pestaña no es una página web (no se puede capturar).");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-capture.js"],
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__emetRecorridosCapture(),
  });
  const snapshot = results && results[0] && results[0].result;
  if (!snapshot || !snapshot.docTree) {
    throw new Error("La captura no devolvió contenido (¿la página bloqueó el script?).");
  }

  let viewport;
  try {
    const vp = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    });
    viewport = vp && vp[0] && vp[0].result;
  } catch {
    viewport = null;
  }

  let thumbnail = null;
  try {
    thumbnail = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    console.warn("[recorridos] no se pudo capturar miniatura:", e);
  }

  return {
    snapshot,
    thumbnail,
    interaction_ctx: { url: tab.url, captured_at: new Date().toISOString() },
    scroll: viewport
      ? { x: viewport.x, y: viewport.y }
      : { x: 0, y: 0 },
    viewport: viewport
      ? { width: viewport.width, height: viewport.height }
      : { width: 1920, height: 1080 },
    highlights: [],
    blurs: [],
  };
}

// ── Countdown de preparación pre-captura ─────────────────────────
async function runCountdown(seconds = 3) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["countdown.js"],
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (secs) => window.__emetRecorridosCountdown(secs),
      args: [seconds],
    });
    return !!(results && results[0] && results[0].result);
  } catch (e) {
    console.warn("[recorridos] no se pudo mostrar el contador:", e);
    return true;
  }
}

// ── Atajo: capturar pantalla ──────────────────────────────────────
async function handleCapture() {
  const recording = await getStoredRecording();
  if (!recording) {
    // Sin grabación en curso: abre el popup para que empiece una.
    await openPopup();
    return;
  }

  const proceed = await runCountdown();
  if (!proceed) {
    notifyPopup({ cancelled: true });
    return;
  }

  try {
    const screen = await captureCurrentScreen();
    recording.screens.push(screen);
    await chrome.storage.local.set({ recording });
    notifyPopup({ captured: screen, index: recording.screens.length - 1 });
  } catch (err) {
    notifyPopup({ error: err instanceof Error ? err.message : "No se pudo capturar la pantalla." });
  }
}

async function openPopup() {
  try {
    await chrome.action.openPopup();
  } catch {
    /* algunos entornos no permiten abrir el popup por comando */
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-screen") handleCapture();
  else if (command === "open-popup") openPopup();
});
