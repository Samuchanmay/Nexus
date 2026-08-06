// ══════════════════════════════════════════════════════════════════
//  EMET Recorridos — captura de pantalla (content script)
//  ══════════════════════════════════════════════════════════════════
//  Se inyecta bajo demanda (chrome.scripting.executeScript con
//  files: ["content-capture.js"]) en la pestaña activa. Define
//  window.__emetRecorridosCapture(), que serializa el DOM actual al
//  mismo formato "SerNode" que consume el reproductor de EMET
//  (src/lib/recorridos/player/deser.ts + types.ts):
//
//    SerNode = { type, name, attrs: {..., "f-id"}, props, chldrn, sv }
//
//  No es un diff: cada captura es un snapshot COMPLETO del <html>
//  actual. El reproductor calcula los diffs entre pantallas consecutivas
//  él mismo en el momento de reproducir (get-diffs.ts) — la extensión
//  no necesita saber nada de eso.
//
//  El "f-id" (id estable por nodo) se guarda en un WeakMap adjunto a
//  `window` para que sobreviva entre varias capturas dentro de la MISMA
//  carga de página (mejora la calidad del diff en reproducción). Al
//  navegar a otra página el WeakMap se pierde junto con el documento
//  anterior — es esperado, cada página es efectivamente un árbol nuevo.
//
//  Limitaciones conocidas de esta v1 (documentadas también en README):
//   - No captura Shadow DOM (isShadowHost/isShadowRoot) ni
//     adoptedStyleSheets.
//   - No desciende dentro de <iframe>/<object> anidados (el reproductor
//     igual sabe mostrarlos en blanco sin romper el resto de la página).
//   - <script> y <noscript> se omiten siempre: el reproductor no debe
//     ejecutar JS ajeno dentro del iframe de reproducción.
//   - Los campos type="password" se capturan con su valor vacío por
//     seguridad (nunca se sube una contraseña real dentro de un demo).
// ══════════════════════════════════════════════════════════════════

(function () {
  function getFid(node, fidMap) {
    var existing = fidMap.get(node);
    if (existing) return existing;
    var id = "f" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    fidMap.set(node, id);
    return id;
  }

  // Atributos que representan una URL: se capturan RESUELTOS a absoluta
  // (vía la propiedad DOM, que el navegador ya resuelve por nosotros).
  // Es indispensable: el iframe del reproductor carga con src="about:blank"
  // y no tiene base URL propia, así que una ruta relativa ("/img/x.png")
  // se rompería al reproducir.
  var URL_ATTR_BY_TAG = {
    a: "href",
    link: "href",
    img: "src",
    script: "src",
    iframe: "src",
    source: "src",
    video: "poster",
    embed: "src",
  };

  function resolveUrlAttrs(el, tag, attrs) {
    var prop = URL_ATTR_BY_TAG[tag];
    if (prop && el[prop]) {
      try {
        attrs[prop] = new URL(el[prop], location.href).href;
      } catch {
        /* URL inválida, se deja el valor crudo del atributo */
      }
    }
    if (tag === "img" && el.currentSrc) {
      try {
        attrs.src = new URL(el.currentSrc, location.href).href;
      } catch {
        /* ignorar */
      }
    }
  }

  function serializeElement(el, ctx) {
    var tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "noscript") return null;

    var fid = getFid(el, ctx.fidMap);
    var attrs = { "f-id": fid };
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      attrs[a.name] = a.value;
    }
    resolveUrlAttrs(el, tag, attrs);

    var props = {};
    var nodeProps = {};

    if (tag === "input" || tag === "textarea") {
      var isPassword = tag === "input" && (el.getAttribute("type") || "").toLowerCase() === "password";
      nodeProps.value = isPassword ? "" : el.value;
      if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) {
        nodeProps.checked = el.checked;
      }
    } else if (tag === "select") {
      nodeProps.value = el.value;
      nodeProps.selectedIndex = el.selectedIndex;
    }
    if (Object.keys(nodeProps).length > 0) props.nodeProps = nodeProps;

    if (tag === "link" && (el.getAttribute("rel") || "").toLowerCase().indexOf("stylesheet") !== -1) {
      props.isStylesheet = true;
    }

    if (tag === "style") {
      try {
        var sheet = el.sheet;
        if (sheet && sheet.cssRules) {
          var rules = [];
          for (var r = 0; r < sheet.cssRules.length; r++) rules.push(sheet.cssRules[r].cssText);
          props.cssRules = rules.join("\n");
        } else {
          props.cssRules = el.textContent || "";
        }
      } catch {
        // Hoja bloqueada por CORS (stylesheet cross-origin sin CORS): se
        // recurre al texto plano de la etiqueta, que normalmente está vacío
        // para un <style> así — se pierde el CSS, pero no rompe la captura.
        props.cssRules = el.textContent || "";
      }
    }

    if (tag === "canvas") {
      try {
        attrs.src = el.toDataURL();
      } catch {
        /* canvas contaminado (imagen cross-origin sin CORS): se omite el snapshot */
      }
    }

    var isHidden = window.getComputedStyle(el).display === "none";
    if (isHidden) props.isHidden = true;

    var chldrn = [];
    if (!isHidden && tag !== "iframe" && tag !== "object") {
      for (var c = 0; c < el.childNodes.length; c++) {
        var ser = serialize(el.childNodes[c], ctx);
        if (ser) chldrn.push(ser);
      }
    }

    return { type: 1 /* Node.ELEMENT_NODE */, name: tag, attrs: attrs, props: props, chldrn: chldrn, sv: 0 };
  }

  function serialize(node, ctx) {
    if (node.nodeType === Node.TEXT_NODE) {
      return { type: 3, name: "#text", attrs: {}, props: { textContent: node.textContent || "" }, chldrn: [], sv: 0 };
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      var fid = getFid(node, ctx.fidMap);
      return {
        type: 8,
        name: "#comment",
        attrs: { "f-id": fid },
        props: { textContent: node.textContent || "" },
        chldrn: [],
        sv: 0,
      };
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return serializeElement(node, ctx);
    }
    // Otros tipos (doctype, processing instructions) no son relevantes
    // para el reproductor y se omiten.
    return null;
  }

  window.__emetRecorridosCapture = function () {
    window.__emetRecorridosFidMap = window.__emetRecorridosFidMap || new WeakMap();
    var ctx = { fidMap: window.__emetRecorridosFidMap };
    var docTree = serialize(document.documentElement, ctx);
    return { version: "2023-07-27", docTree: docTree };
  };
})();
