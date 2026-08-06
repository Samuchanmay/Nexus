// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — Modo de selección de elementos (highlight/blur)
//  ══════════════════════════════════════════════════════════════════
//  Permite al usuario hacer clic en elementos del DOM para resaltarlos
//  (highlight) o aplicarles blur. Los elementos seleccionados se guardan
//  con su selector CSS y se aplican al reproducir el recorrido.
//
//  Inspirado en Fable (Apache 2.0): https://github.com/anthropics/fable
// ══════════════════════════════════════════════════════════════════

(function() {
  if (window.__emetRecorridosSelectMode) return;
  window.__emetRecorridosSelectMode = true;

  let mode = null; // 'highlight' | 'blur' | null
  let selectedElements = [];
  let overlay = null;
  let tooltip = null;

  // ── Crear overlay visual ────────────────────────────────────────
  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'emet-select-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
    `;
    document.body.appendChild(overlay);
  }

  // ── Crear tooltip de instrucciones ──────────────────────────────
  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.id = 'emet-select-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    updateTooltip();
    document.body.appendChild(tooltip);
  }

  function updateTooltip() {
    if (!tooltip) return;
    const modeText = mode === 'highlight' ? 'resaltar' : 'ocultar con blur';
    tooltip.innerHTML = `
      <span style="background: ${mode === 'highlight' ? '#3B82F6' : '#EF4444'}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
        ${mode === 'highlight' ? '🔆 Resaltar' : '🔒 Ocultar'}
      </span>
      <span>Haz clic en elementos para ${modeText}</span>
      <button id="emet-select-autoredact" style="background: #F59E0B; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">
        🔒 Auto-redactar
      </button>
      <button id="emet-select-done" style="background: #10B981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        Listo
      </button>
      <span id="emet-select-count" style="font-size: 12px; color: #b0b0b0;">${selectedElements.length}</span>
    `;
    
    const doneBtn = tooltip.querySelector('#emet-select-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        window.__emetRecorridosExitSelectMode();
      });
    }
    const arBtn = tooltip.querySelector('#emet-select-autoredact');
    if (arBtn) {
      arBtn.addEventListener('click', () => {
        window.__emetRecorridosAutoRedact();
        updateTooltip();
      });
    }
  }

  // ── Generar selector CSS único para un elemento ─────────────────
  function getSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className) {
        const classes = Array.from(current.classList)
          .filter(c => c && !c.startsWith('emet-'))
          .slice(0, 2)
          .map(c => `.${c}`)
          .join('');
        if (classes) selector += classes;
      }
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          s => s.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      // Limitar profundidad
      if (path.length > 5) break;
    }
    
    return path.join(' > ');
  }

  // ── Highlight visual temporal (hover) ───────────────────────────
  let hoverOverlay = null;

  function showHoverHighlight(element) {
    if (hoverOverlay) hoverOverlay.remove();
    
    hoverOverlay = document.createElement('div');
    const rect = element.getBoundingClientRect();
    
    hoverOverlay.style.cssText = `
      position: fixed;
      top: ${rect.top + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 999998;
      border: 2px solid ${mode === 'highlight' ? '#3B82F6' : '#EF4444'};
      background: ${mode === 'highlight' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
      border-radius: 4px;
      transition: all 0.15s ease;
    `;
    
    document.body.appendChild(hoverOverlay);
  }

  function hideHoverHighlight() {
    if (hoverOverlay) {
      hoverOverlay.remove();
      hoverOverlay = null;
    }
  }

  // ── Agregar elemento a la lista ─────────────────────────────────
  function addElement(element) {
    const selector = getSelector(element);
    const rect = element.getBoundingClientRect();
    
    selectedElements.push({
      selector,
      type: mode,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      text: element.textContent?.slice(0, 50) || '',
    });
    
    // Feedback visual
    element.style.transition = 'all 0.3s ease';
    if (mode === 'highlight') {
      element.style.boxShadow = '0 0 0 3px #3B82F6, 0 0 20px rgba(59, 130, 246, 0.5)';
    } else {
      // Blur adaptivo al tamaño del elemento (mejor a pequeña escala)
      const area = rect.width * rect.height;
      const blur = Math.min(Math.ceil(6 + Math.sqrt(area) * 0.006), 16);
      element.style.filter = `blur(${blur}px)`;
      element.style.transition = 'filter 0.3s ease';
    }
    
    setTimeout(() => {
      element.style.boxShadow = '';
      element.style.filter = '';
    }, 500);
  }

  // ── Event listeners ─────────────────────────────────────────────
  function onMouseMove(e) {
    if (!mode) return;
    
    const element = e.target;
    if (element.closest('#emet-select-tooltip, #emet-select-overlay')) return;
    
    showHoverHighlight(element);
  }

  function onClick(e) {
    if (!mode) return;
    
    const element = e.target;
    if (element.closest('#emet-select-tooltip, #emet-select-overlay')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    addElement(element);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      window.__emetRecorridosExitSelectMode();
    } else if (e.key === 'h' || e.key === 'H') {
      mode = 'highlight';
      updateTooltip();
    } else if (e.key === 'b' || e.key === 'B') {
      mode = 'blur';
      updateTooltip();
    } else if (e.key === 'a' || e.key === 'A') {
      window.__emetRecorridosAutoRedact();
      updateTooltip();
    }
  }

  // ── Auto-redactar datos sensibles (emails, precios, números) ─────
  function getDirectText(el) {
    let text = '';
    for (let c = 0; c < el.childNodes.length; c++) {
      if (el.childNodes[c].nodeType === Node.TEXT_NODE) text += el.childNodes[c].textContent;
    }
    return text;
  }

  window.__emetRecorridosAutoRedact = function () {
    const patterns = [
      /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/, // emails
      /\$\s?\d[\d.,]*/,                // precios ($12,450.50)
      /\b\d{10,}\b/,                   // teléfonos / tarjetas (10+ dígitos)
    ];

    const candidates = [];
    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest && el.closest('#emet-select-tooltip, #emet-select-overlay')) continue;

      const directText = getDirectText(el);
      if (!directText) continue;

      let matched = false;
      for (let p = 0; p < patterns.length; p++) {
        if (patterns[p].test(directText)) { matched = true; break; }
      }
      if (!matched) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      candidates.push({ el, rect, area: rect.width * rect.height });
    }

    // Los más pequeños primero; descartar los que caigan dentro de otro ya añadido
    candidates.sort((a, b) => a.area - b.area);

    let added = 0;
    const coverage = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const inside = coverage.some((r) =>
        r.left <= c.rect.left + 1 && r.top <= c.rect.top + 1 &&
        r.right >= c.rect.right - 1 && r.bottom >= c.rect.bottom - 1
      );
      if (inside) continue;

      selectedElements.push({
        selector: getSelector(c.el),
        type: 'blur',
        rect: {
          top: c.rect.top,
          left: c.rect.left,
          width: c.rect.width,
          height: c.rect.height,
        },
        text: c.el.textContent?.slice(0, 50) || '',
        auto: true,
      });
      coverage.push({
        left: c.rect.left,
        top: c.rect.top,
        right: c.rect.right,
        bottom: c.rect.bottom,
      });

      const blur = Math.min(Math.ceil(6 + Math.sqrt(c.area) * 0.006), 16);
      c.el.style.transition = 'filter 0.3s ease';
      c.el.style.filter = `blur(${blur}px)`;
      setTimeout(() => { c.el.style.filter = ''; }, 500);
      added += 1;
    }

    return added;
  };

  // ── API pública ─────────────────────────────────────────────────
  window.__emetRecorridosEnterSelectMode = function(initialMode = 'highlight') {
    mode = initialMode;
    selectedElements = [];
    
    createOverlay();
    createTooltip();
    
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    
    document.body.style.cursor = 'crosshair';
    
    return { mode, selectedElements };
  };

  window.__emetRecorridosExitSelectMode = function() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
    if (hoverOverlay) {
      hoverOverlay.remove();
      hoverOverlay = null;
    }
    
    document.body.style.cursor = '';
    mode = null;
    
    window.__emetRecorridosSelectMode = false;
    
    return selectedElements;
  };

  window.__emetRecorridosSwitchMode = function(newMode) {
    mode = newMode;
    updateTooltip();
  };

  window.__emetRecorridosGetSelectedElements = function() {
    return selectedElements;
  };
})();
