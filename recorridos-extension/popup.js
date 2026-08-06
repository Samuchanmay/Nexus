// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — lógica del popup
//  ══════════════════════════════════════════════════════════════════
//  El popup de una extensión se destruye cada vez que se cierra, así que
//  TODO el estado de la grabación en curso vive en chrome.storage.local
//  bajo la clave "recording" — sobrevive a que el usuario cierre el
//  popup para navegar entre pantallas de la app y lo vuelva a abrir.
//
//  Contrato de subida (POST {server}/api/demos/ingest, ver
//  src/app/api/demos/ingest/route.ts): requiere sesión de admin ya
//  iniciada en el navegador (se manda con credentials:"include", nunca
//  se le pide al usuario ninguna contraseña ni token aquí). Devuelve
//  { error } con el mensaje real cuando falla — ese mensaje se muestra
//  tal cual, nunca "[object Object]" ni un genérico que oculte la causa.
// ══════════════════════════════════════════════════════════════════

const DEFAULT_SERVER = "https://emet.uno";

const $ = (id) => document.getElementById(id);

const els = {
  setupView: $("setup-view"),
  recordingView: $("recording-view"),
  title: $("f-title"),
  slug: $("f-slug"),
  description: $("f-description"),
  role: $("f-role"),
  status: $("f-status"),
  server: $("f-server"),
  btnStart: $("btn-start"),
  recTitleText: $("rec-title-text"),
  recCount: $("rec-count"),
  recList: $("rec-list"),
  btnCapture: $("btn-capture"),
  btnUndo: $("btn-undo"),
  btnFinish: $("btn-finish"),
  btnCancel: $("btn-cancel"),
  statusLine: $("status-line"),
};

function showStatus(message, kind) {
  els.statusLine.textContent = message;
  els.statusLine.className = `status ${kind}`;
  els.statusLine.classList.remove("hidden");
}

function clearStatus() {
  els.statusLine.classList.add("hidden");
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function getStoredRecording() {
  const { recording } = await chrome.storage.local.get("recording");
  return recording || null;
}

async function setStoredRecording(recording) {
  if (recording) {
    await chrome.storage.local.set({ recording });
  } else {
    await chrome.storage.local.remove("recording");
  }
}

async function getStoredServer() {
  const { server_base } = await chrome.storage.local.get("server_base");
  return server_base || DEFAULT_SERVER;
}

// ── Vista: alterna entre "configurar" y "grabando" ─────────────────
function renderSetup() {
  els.setupView.classList.remove("hidden");
  els.recordingView.classList.add("hidden");
}

function renderRecording(recording) {
  els.setupView.classList.add("hidden");
  els.recordingView.classList.remove("hidden");
  els.recTitleText.textContent = recording.title;
  els.recCount.textContent = String(recording.screens.length);
  els.recList.innerHTML = "";
  recording.screens.forEach((screen, i) => {
    const li = document.createElement("li");
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = String(i + 1);
    const url = document.createElement("span");
    url.className = "url";
    url.textContent = (screen.interaction_ctx && screen.interaction_ctx.url) || "(sin URL)";
    li.appendChild(idx);
    if (screen.thumbnail) {
      const img = document.createElement("img");
      img.src = screen.thumbnail;
      li.appendChild(img);
    }
    li.appendChild(url);
    els.recList.appendChild(li);
  });
}

// ── Captura: inyecta content-capture.js en la pestaña activa y llama
//    a la función global que expone ──────────────────────────────────
async function captureCurrentScreen() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

  let thumbnail = null;
  try {
    thumbnail = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    // La miniatura es decorativa (se ve en el listado del admin); si falla
    // no se aborta la captura, solo se sube sin miniatura para ese paso.
    console.warn("[recorridos] no se pudo capturar miniatura:", e);
  }

  return {
    snapshot,
    thumbnail,
    interaction_ctx: { url: tab.url, captured_at: new Date().toISOString() },
  };
}

// ── Subida final ─────────────────────────────────────────────────
async function uploadRecording(recording) {
  const server = (recording.server || DEFAULT_SERVER).replace(/\/+$/, "");
  const res = await fetch(`${server}/api/demos/ingest`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: recording.title,
      slug: recording.slug,
      description: recording.description || undefined,
      target_role: recording.target_role,
      status: recording.status,
      screens: recording.screens,
    }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    // Respuesta sin JSON (por ejemplo un 502 de un proxy intermedio): se
    // arma un mensaje explícito en vez de dejar `data` vacío en silencio.
    data = { error: `El servidor respondió ${res.status} sin cuerpo JSON.` };
  }

  if (!res.ok) {
    // Mismo criterio que el resto de EMET (src/lib/errors.ts): mostrar el
    // mensaje real que mandó el backend, nunca un objeto crudo.
    throw new Error(data.error || `Error ${res.status} al subir el recorrido.`);
  }
  return data;
}

// ── Eventos de UI ────────────────────────────────────────────────
els.btnStart.addEventListener("click", async () => {
  clearStatus();
  const title = els.title.value.trim();
  let slug = els.slug.value.trim();
  if (!slug && title) slug = slugify(title);
  slug = slugify(slug);

  if (!title) return showStatus("Falta el título del recorrido.", "error");
  if (!slug) return showStatus("El slug quedó vacío; usa letras y números.", "error");

  const server = els.server.value.trim() || DEFAULT_SERVER;
  await chrome.storage.local.set({ server_base: server });

  const recording = {
    title,
    slug,
    description: els.description.value.trim(),
    target_role: els.role.value,
    status: els.status.value,
    server,
    screens: [],
  };
  await setStoredRecording(recording);
  renderRecording(recording);
  showStatus("Grabación iniciada. Navega en la pestaña y captura cada paso.", "info");
});

els.btnCapture.addEventListener("click", async () => {
  clearStatus();
  els.btnCapture.disabled = true;
  try {
    const recording = await getStoredRecording();
    if (!recording) return renderSetup();
    const screen = await captureCurrentScreen();
    recording.screens.push(screen);
    await setStoredRecording(recording);
    renderRecording(recording);
    showStatus(`Pantalla ${recording.screens.length} capturada.`, "ok");
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "No se pudo capturar la pantalla.", "error");
  } finally {
    els.btnCapture.disabled = false;
  }
});

els.btnUndo.addEventListener("click", async () => {
  clearStatus();
  const recording = await getStoredRecording();
  if (!recording || recording.screens.length === 0) return;
  recording.screens.pop();
  await setStoredRecording(recording);
  renderRecording(recording);
});

els.btnFinish.addEventListener("click", async () => {
  clearStatus();
  const recording = await getStoredRecording();
  if (!recording) return renderSetup();
  if (recording.screens.length === 0) {
    return showStatus("Captura al menos una pantalla antes de subir.", "error");
  }
  els.btnFinish.disabled = true;
  els.btnCancel.disabled = true;
  showStatus("Subiendo recorrido…", "info");
  try {
    const data = await uploadRecording(recording);
    await setStoredRecording(null);
    renderSetup();
    showStatus(
      `Recorrido subido (${data.screens} pantallas, estado: ${data.status}). Revísalo en /preptour.`,
      "ok",
    );
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "No se pudo subir el recorrido.", "error");
  } finally {
    els.btnFinish.disabled = false;
    els.btnCancel.disabled = false;
  }
});

els.btnCancel.addEventListener("click", async () => {
  const recording = await getStoredRecording();
  if (recording && recording.screens.length > 0) {
    const ok = confirm(`Se perderán ${recording.screens.length} pantalla(s) capturadas. ¿Cancelar?`);
    if (!ok) return;
  }
  await setStoredRecording(null);
  clearStatus();
  renderSetup();
});

// ── Arranque del popup ──────────────────────────────────────────
(async function init() {
  els.server.value = await getStoredServer();
  const recording = await getStoredRecording();
  if (recording) {
    renderRecording(recording);
  } else {
    renderSetup();
  }
})();
