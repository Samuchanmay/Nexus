// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — lógica del popup (v3 - Diseño profesional)
//  ══════════════════════════════════════════════════════════════════

const DEFAULT_SERVER = "https://emet.uno";

const $ = (id) => document.getElementById(id);

const els = {
  // Tabs
  tabs: document.querySelectorAll('.tab'),
  tabRecord: $('tab-record'),
  tabLibrary: $('tab-library'),
  
  // Setup view
  setupView: $("setup-view"),
  recordingView: $("recording-view"),
  title: $("f-title"),
  slug: $("f-slug"),
  description: $("f-description"),
  role: $("f-role"),
  status: $("f-status"),
  server: $("f-server"),
  btnStart: $("btn-start"),
  
  // Recording view
  recTitleText: $("rec-title-text"),
  recCount: $("rec-count"),
  recList: $("rec-list"),
  btnCapture: $("btn-capture"),
  btnUndo: $("btn-undo"),
  btnFinish: $("btn-finish"),
  btnCancel: $("btn-cancel"),
  
  // Library
  libraryEmpty: $("library-empty"),
  libraryList: $("library-list"),
  
  // Editor
  editorOverlay: $("editor-overlay"),
  editorTitle: $("editor-title"),
  editorClose: $("editor-close"),
  editTitle: $("edit-title"),
  editDescription: $("edit-description"),
  editRole: $("edit-role"),
  editScreenCount: $("edit-screen-count"),
  editScreensList: $("edit-screens-list"),
  editorDelete: $("editor-delete"),
  editorSave: $("editor-save"),
  
  // Preview
  previewOverlay: $("preview-overlay"),
  previewPrev: $("preview-prev"),
  previewNext: $("preview-next"),
  previewClose: $("preview-close"),
  previewCounter: $("preview-counter"),
  previewImage: $("preview-image"),
  previewHighlights: $("preview-highlights"),
  previewCaption: $("preview-caption"),
  
  statusLine: $("status-line"),
};

// ── Estado global ────────────────────────────────────────────────
let currentEditingTour = null;
let currentPreviewTour = null;
let currentPreviewIndex = 0;

// ── Sync con capturas del service worker (atajos de teclado) ─────
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "recording-updated") return;
  const editing = !els.recordingView.classList.contains("hidden");
  if (!editing) return;
  getStoredRecording().then((recording) => {
    if (recording) renderRecording(recording);
  });
  if (msg.captured) {
    showStatus(`Pantalla ${msg.index + 1} capturada (atajo).`, "ok");
  } else if (msg.error) {
    showStatus(msg.error, "error");
  }
});

// ── Utilidades ───────────────────────────────────────────────────
function showStatus(message, kind) {
  els.statusLine.textContent = message;
  els.statusLine.className = `status ${kind}`;
  els.statusLine.classList.remove("hidden");
  
  // Auto-ocultar después de 5 segundos
  setTimeout(() => {
    els.statusLine.classList.add("hidden");
  }, 5000);
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

async function getLibrary() {
  const { library } = await chrome.storage.local.get("library");
  return library || [];
}

async function setLibrary(library) {
  await chrome.storage.local.set({ library });
}

// ── Tabs ─────────────────────────────────────────────────────────
els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    
    els.tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    
    els.tabRecord.classList.remove('active');
    els.tabLibrary.classList.remove('active');
    
    if (target === 'record') {
      els.tabRecord.classList.add('active');
    } else {
      els.tabLibrary.classList.add('active');
      renderLibrary();
    }
  });
});

// ── Vista: alterna entre "configurar" y "grabando" ───────────────
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
      img.alt = `Captura ${i + 1}`;
      li.appendChild(img);
    }
    li.appendChild(url);
    els.recList.appendChild(li);
  });
}

// ── Captura: inyecta content-capture.js en la pestaña activa ─────
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
    data = { error: `El servidor respondió ${res.status} sin cuerpo JSON.` };
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} al subir el recorrido.`);
  }
  return data;
}

// ── Biblioteca ───────────────────────────────────────────────────
async function renderLibrary() {
  const library = await getLibrary();
  
  if (library.length === 0) {
    els.libraryEmpty.classList.remove("hidden");
    els.libraryList.classList.add("hidden");
    return;
  }
  
  els.libraryEmpty.classList.add("hidden");
  els.libraryList.classList.remove("hidden");
  els.libraryList.innerHTML = "";
  
  library.forEach((tour, index) => {
    const item = document.createElement("div");
    item.className = "library-item";
    
    const screenCount = tour.screens?.length || 0;
    const date = new Date(tour.created_at).toLocaleDateString('es-MX', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    });
    
    item.innerHTML = `
      <div class="library-item-header">
        <span class="library-item-title">${tour.title}</span>
        <span class="library-item-badge ${tour.status}">${tour.status}</span>
      </div>
      <div class="library-item-meta">
        <span>📸 ${screenCount} pantalla${screenCount !== 1 ? 's' : ''}</span>
        <span>📅 ${date}</span>
      </div>
      <div class="library-item-actions">
        <button class="subtle" data-action="preview">👁️ Ver</button>
        <button class="subtle" data-action="edit">✏️ Editar</button>
        <button class="subtle" data-action="upload">📤 Subir</button>
        <button class="danger" data-action="delete">🗑️ Eliminar</button>
      </div>
    `;
    
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'preview') openPreview(tour);
        else if (action === 'edit') openEditor(tour, index);
        else if (action === 'upload') uploadTour(tour, index);
        else if (action === 'delete') deleteTour(tour, index);
      });
    });
    
    els.libraryList.appendChild(item);
  });
}

// ── Editor ───────────────────────────────────────────────────────
function openEditor(tour, index) {
  currentEditingTour = { ...tour, index };
  
  els.editorTitle.textContent = "Editar recorrido";
  els.editTitle.value = tour.title;
  els.editDescription.value = tour.description || "";
  els.editRole.value = tour.target_role;
  
  renderEditorScreens(tour.screens || []);
  
  els.editorOverlay.classList.remove("hidden");
}

function renderEditorScreens(screens) {
  els.editScreenCount.textContent = screens.length;
  els.editScreensList.innerHTML = "";
  
  screens.forEach((screen, i) => {
    const item = document.createElement("div");
    item.className = "edit-screen-item";
    
    const highlightCount = screen.highlights?.length || 0;
    const blurCount = screen.blurs?.length || 0;
    
    item.innerHTML = `
      ${screen.thumbnail ? `<img src="${screen.thumbnail}" alt="Pantalla ${i + 1}" />` : ''}
      <div class="edit-screen-item-info">
        <div class="edit-screen-item-title">Pantalla ${i + 1}</div>
        <div class="edit-screen-item-meta">
          ${highlightCount > 0 ? `🔆 ${highlightCount}` : ''}
          ${blurCount > 0 ? `🔒 ${blurCount}` : ''}
          ${highlightCount === 0 && blurCount === 0 ? 'Sin ediciones' : ''}
        </div>
      </div>
      <div class="edit-screen-item-actions">
        <button class="subtle" data-action="edit-screen" title="Editar highlights/blurs">✏️</button>
        <button class="subtle" data-action="insert-after" title="Insertar captura después de esta pantalla">➕</button>
        <button class="subtle" data-action="move-up" title="Mover arriba" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="subtle" data-action="move-down" title="Mover abajo" ${i === screens.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="danger" data-action="delete-screen" title="Eliminar pantalla">🗑️</button>
      </div>
    `;
    
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'edit-screen') editScreen(i);
        else if (action === 'insert-after') insertScreen(i);
        else if (action === 'move-up') moveScreen(i, i - 1);
        else if (action === 'move-down') moveScreen(i, i + 1);
        else if (action === 'delete-screen') deleteScreen(i);
      });
    });
    
    els.editScreensList.appendChild(item);
  });
}

async function editScreen(index) {
  const tour = currentEditingTour;
  const screen = tour.screens[index];
  
  const url = screen.interaction_ctx?.url;
  if (!url) {
    showStatus("No se puede editar esta pantalla (sin URL).", "error");
    return;
  }
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus("No se encontró una pestaña activa.", "error");
    return;
  }
  
  await chrome.tabs.update(tab.id, { url });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const scroll = screen.scroll || { x: 0, y: 0 };
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sx, sy) => window.scrollTo(sx, sy),
    args: [scroll.x, scroll.y],
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["select-mode.js"],
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.__emetRecorridosEnterSelectMode('highlight');
    },
  });
  
  showStatus("Modo edición activado. Haz clic en elementos para resaltarlos o ocultarlos. Presiona 'H' para highlight, 'B' para blur, 'Esc' para terminar.", "info");
  
  els.editorOverlay.classList.add("hidden");
  
  const checkInterval = setInterval(async () => {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !window.__emetRecorridosSelectMode,
    });
    
    if (result && result[0] && result[0].result) {
      clearInterval(checkInterval);
      
      const selectedResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__emetRecorridosExitSelectMode(),
      });
      
      if (selectedResult && selectedResult[0]) {
        const selectedElements = selectedResult[0].result || [];
        
        const highlights = selectedElements.filter(e => e.type === 'highlight');
        const blurs = selectedElements.filter(e => e.type === 'blur');
        
        tour.screens[index].highlights = highlights;
        tour.screens[index].blurs = blurs;
        
        const library = await getLibrary();
        library[tour.index] = tour;
        await setLibrary(library);
        
        openEditor(tour, tour.index);
        
        showStatus(`Pantalla ${index + 1} actualizada: ${highlights.length} highlights, ${blurs.length} blurs.`, "ok");
      }
    }
  }, 1000);
}

async function insertScreen(index) {
  const tour = currentEditingTour;
  try {
    const screen = await captureCurrentScreen();
    tour.screens.splice(index + 1, 0, screen);
    renderEditorScreens(tour.screens);
    showStatus(`Pantalla insertada después de la ${index + 1}.`, "ok");
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "No se pudo capturar la pantalla.", "error");
  }
}

function moveScreen(fromIndex, toIndex) {
  const tour = currentEditingTour;
  const screens = tour.screens;
  
  if (toIndex < 0 || toIndex >= screens.length) return;
  
  const [screen] = screens.splice(fromIndex, 1);
  screens.splice(toIndex, 0, screen);
  
  renderEditorScreens(screens);
}

function deleteScreen(index) {
  const tour = currentEditingTour;
  
  if (!confirm(`¿Eliminar pantalla ${index + 1}?`)) return;
  
  tour.screens.splice(index, 1);
  renderEditorScreens(tour.screens);
}

els.editorClose.addEventListener("click", () => {
  els.editorOverlay.classList.add("hidden");
  currentEditingTour = null;
});

els.editorSave.addEventListener("click", async () => {
  if (!currentEditingTour) return;
  
  const tour = currentEditingTour;
  tour.title = els.editTitle.value.trim();
  tour.description = els.editDescription.value.trim();
  tour.target_role = els.editRole.value;
  tour.updated_at = new Date().toISOString();
  
  const library = await getLibrary();
  library[tour.index] = tour;
  await setLibrary(library);
  
  els.editorOverlay.classList.add("hidden");
  currentEditingTour = null;
  
  renderLibrary();
  showStatus("Recorrido actualizado.", "ok");
});

els.editorDelete.addEventListener("click", async () => {
  if (!currentEditingTour) return;
  
  if (!confirm("¿Eliminar este recorrido permanentemente?")) return;
  
  const library = await getLibrary();
  library.splice(currentEditingTour.index, 1);
  await setLibrary(library);
  
  els.editorOverlay.classList.add("hidden");
  currentEditingTour = null;
  
  renderLibrary();
  showStatus("Recorrido eliminado.", "ok");
});

// ── Preview ──────────────────────────────────────────────────────
function openPreview(tour) {
  currentPreviewTour = tour;
  currentPreviewIndex = 0;
  
  renderPreview();
  
  els.previewOverlay.classList.remove("hidden");
}

function renderPreview() {
  const tour = currentPreviewTour;
  const screen = tour.screens[currentPreviewIndex];
  
  els.previewCounter.textContent = `${currentPreviewIndex + 1} / ${tour.screens.length}`;
  
  if (screen.thumbnail) {
    els.previewImage.src = screen.thumbnail;
    els.previewImage.style.display = "block";
  } else {
    els.previewImage.style.display = "none";
  }
  
  els.previewHighlights.innerHTML = "";
  
  const imgRect = els.previewImage.getBoundingClientRect();

  const vp = screen.viewport || screen.snapshot?.viewport || { width: 1920, height: 1080 };
  const scaleX = imgRect.width / (vp.width || 1920);
  const scaleY = imgRect.height / (vp.height || 1080);
  
  (screen.highlights || []).forEach(h => {
    const div = document.createElement("div");
    div.className = "preview-highlight";
    div.style.left = `${h.rect.left * scaleX}px`;
    div.style.top = `${h.rect.top * scaleY}px`;
    div.style.width = `${h.rect.width * scaleX}px`;
    div.style.height = `${h.rect.height * scaleY}px`;
    els.previewHighlights.appendChild(div);
  });
  
  (screen.blurs || []).forEach(b => {
    const div = document.createElement("div");
    div.className = "preview-blur";
    div.style.left = `${b.rect.left * scaleX}px`;
    div.style.top = `${b.rect.top * scaleY}px`;
    div.style.width = `${b.rect.width * scaleX}px`;
    div.style.height = `${b.rect.height * scaleY}px`;
    els.previewHighlights.appendChild(div);
  });
  
  els.previewCaption.textContent = screen.interaction_ctx?.url || "";
  
  els.previewPrev.disabled = currentPreviewIndex === 0;
  els.previewNext.disabled = currentPreviewIndex === tour.screens.length - 1;
}

els.previewPrev.addEventListener("click", () => {
  if (currentPreviewIndex > 0) {
    currentPreviewIndex--;
    renderPreview();
  }
});

els.previewNext.addEventListener("click", () => {
  if (currentPreviewTour && currentPreviewIndex < currentPreviewTour.screens.length - 1) {
    currentPreviewIndex++;
    renderPreview();
  }
});

els.previewClose.addEventListener("click", () => {
  els.previewOverlay.classList.add("hidden");
  currentPreviewTour = null;
});

// ── Subir recorrido ──────────────────────────────────────────────
async function uploadTour(tour, index) {
  if (!confirm(`¿Subir "${tour.title}" al servidor?`)) return;
  
  showStatus("Subiendo recorrido...", "info");
  
  try {
    const data = await uploadRecording(tour);
    
    const library = await getLibrary();
    library[index].uploaded = true;
    library[index].uploaded_at = new Date().toISOString();
    await setLibrary(library);
    
    renderLibrary();
    showStatus(`Recorrido subido (${data.screens} pantallas, estado: ${data.status}).`, "ok");
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "No se pudo subir el recorrido.", "error");
  }
}

// ── Eliminar recorrido ───────────────────────────────────────────
async function deleteTour(tour, index) {
  if (!confirm(`¿Eliminar "${tour.title}" permanentemente?`)) return;
  
  const library = await getLibrary();
  library.splice(index, 1);
  await setLibrary(library);
  
  renderLibrary();
  showStatus("Recorrido eliminado.", "ok");
}

// ── Eventos de UI (grabación) ────────────────────────────────────
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
    created_at: new Date().toISOString(),
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
    return showStatus("Captura al menos una pantalla antes de guardar.", "error");
  }
  
  const library = await getLibrary();
  library.push({
    ...recording,
    id: crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  });
  await setLibrary(library);
  
  await setStoredRecording(null);
  renderSetup();
  
  els.title.value = "";
  els.slug.value = "";
  els.description.value = "";
  
  showStatus(`Recorrido guardado en "Mis recorridos" (${recording.screens.length} pantallas).`, "ok");
  
  setTimeout(() => {
    document.querySelector('.tab[data-tab="library"]').click();
  }, 1000);
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
