import { FABLE_CUSTOM_NODE, type DeSerProps, type SerNode } from "./types";
import { addPointerEventsAutoToEl, nanoid, raiseDeferredError } from "./utils";

export function purifySrcDoc(htmlStr: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, "text/html");
    const scripts = doc.querySelectorAll("script");
    scripts.forEach((script) => script.remove());
    let doctype = "";
    if (doc.doctype) {
      doctype = `<!DOCTYPE ${doc.doctype.name}>`;
    }
    return `${doctype}\n${doc.documentElement.outerHTML}`;
  } catch {
    return htmlStr;
  }
}

export const deser = (
  serNode: SerNode,
  doc: Document,
  version: string,
  frameLoadingPromises: Promise<unknown>[],
  assetLoadingPromises: Promise<unknown>[],
  nestedFrames: HTMLIFrameElement[],
  props: DeSerProps = { partOfSvgEl: 0, shadowParent: null },
  shouldAddImgToAssetLoadingPromises = false,
): Node | null | undefined => {
  const newProps: DeSerProps = {
    partOfSvgEl: props.partOfSvgEl | (serNode.name === "svg" ? 1 : 0),
    shadowParent: props.shadowParent,
  };

  let node: Node | null | undefined;
  switch (serNode.type) {
    case Node.TEXT_NODE:
      node = doc.createTextNode(String(serNode.props.textContent ?? ""));
      break;
    case Node.ELEMENT_NODE:
      if (serNode.name === "meta") {
        node = doc.createComment(`metafid/${serNode.attrs["f-id"]}`);
      } else {
        try {
          node = createHtmlElement(serNode, doc, newProps, assetLoadingPromises, shouldAddImgToAssetLoadingPromises);
          newProps.shadowParent = (node as HTMLElement).shadowRoot ?? null;
          if (node.nodeName.toLowerCase() === "body") {
            deserCustomCssStyleSheets(serNode, doc, node);
          }
          try {
            if (serNode.name.toLowerCase().includes("-")) {
              const win = doc.defaultView;
              if (win) {
                const CustomElement = class extends (win.HTMLElement as typeof HTMLElement) {};
                win.customElements.define(serNode.name.toLowerCase(), CustomElement);
              }
            }
          } catch {
            /* registro duplicado ignorado */
          }
        } catch (e) {
          raiseDeferredError((e as Error).message);
        }
      }
      break;
    case Node.COMMENT_NODE: {
      let commentText = String(serNode.props.textContent ?? "");
      if (!commentText || serNode.name !== "#comment") {
        commentText = `elfid/${serNode.attrs["f-id"]}`;
      }
      node = doc.createComment(commentText);
      break;
    }
    case Node.DOCUMENT_FRAGMENT_NODE:
      node = newProps.shadowParent;
      if (node) deserCustomCssStyleSheets(serNode, doc, node);
      break;
    case FABLE_CUSTOM_NODE: {
      try {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = String(serNode.props.content ?? "");
        node = wrapper.children[0] ?? null;
        if (node) (node as HTMLElement).setAttribute("f-id", serNode.attrs["f-id"] ?? nanoid());
      } catch (err) {
        raiseDeferredError((err as Error).message);
      }
      break;
    }
    default:
      break;
  }

  if (!serNode.props.isHidden && !(serNode.name === "iframe" || serNode.name === "object")) {
    for (const child of serNode.chldrn) {
      const childNode = deser(
        child,
        doc,
        version,
        frameLoadingPromises,
        assetLoadingPromises,
        nestedFrames,
        newProps,
        shouldAddImgToAssetLoadingPromises,
      );
      if (childNode && node && !child.props.isShadowRoot) {
        node.appendChild(childNode);
        if (child.name === "iframe" || child.name === "object") {
          const tNode = childNode as HTMLIFrameElement;
          const htmlNode = child.chldrn.find((n) => n.type === Node.ELEMENT_NODE && n.name === "html");
          if (htmlNode) {
            const p = new Promise((resolve) => {
              tNode.onabort = () => {
                resolve(1);
              };
              tNode.onerror = () => {
                resolve(1);
              };
              tNode.onload = () => {
                const newDoc = tNode.contentDocument;
                if (newDoc) {
                  deserFrame(htmlNode, newDoc, version, frameLoadingPromises, assetLoadingPromises, nestedFrames);
                  nestedFrames.push(tNode);
                }
                resolve(1);
              };
            });
            frameLoadingPromises.push(p);
          }
        } else if (serNode.name === "select") {
          for (const [nodePropKey, nodePropValue] of Object.entries((serNode.props.nodeProps as unknown as Record<string, unknown>) || {})) {
            (node as unknown as Record<string, unknown>)[nodePropKey] = nodePropValue;
          }
        }
      }
    }
  }

  return node;
};

export const createHtmlElement = (
  node: SerNode,
  doc: Document,
  props: DeSerProps,
  assetLoadingPromises: Promise<unknown>[],
  shouldAddImgToAssetLoadingPromises: boolean,
): Node => {
  const el = props.partOfSvgEl
    ? doc.createElementNS("http://www.w3.org/2000/svg", node.name)
    : doc.createElement(node.name);

  if (node.name === "canvas") {
    const element = el as HTMLCanvasElement;
    element.width = +(node.attrs.width ?? 0);
    element.height = +(node.attrs.height ?? 0);
    const ctx = element.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, +node.attrs.width!, +node.attrs.height!);
      const img = document.createElement("img");
      img.src = node.attrs.src!;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, +node.attrs.width!, +node.attrs.height!);
        img.onload = null;
      };
    }
  }

  if (node.name === "form") {
    el.addEventListener("submit", stopEventBehaviour);
  } else if (node.name === "input") {
    el.addEventListener("click", stopEventBehaviour);
  }

  for (const [nodePropKey, nodePropValue] of Object.entries((node.props.nodeProps as unknown as Record<string, unknown>) || {})) {
    if (node.name === "input" && node.attrs.type === "file" && nodePropKey === "value") {
      (el as unknown as Record<string, unknown>)[nodePropKey] = "";
      continue;
    }
    if (node.name === "input" && node.attrs.type === "text" && nodePropKey === "value" && (nodePropValue as string).length !== 0) {
      (el as HTMLInputElement).setAttribute("value", nodePropValue as string);
      continue;
    }
    (el as unknown as Record<string, unknown>)[nodePropKey] = nodePropValue;
  }

  let attrKey: string;
  let attrValue: string;
  const attrsToSkip = ["integrity", "dxdy", "cdxdy"];
  for ([attrKey, attrValue] of Object.entries(node.attrs)) {
    try {
      if (attrsToSkip.includes(attrKey.toLowerCase())) continue;
      if (node.name === "iframe" && attrKey === "loading") continue;
      if (node.name === "iframe" && attrKey === "name" && attrValue === "body") attrValue += "-normalized";
      if (node.name === "iframe" && attrKey === "src") {
        attrValue = "about:blank";
        el.setAttribute(attrKey, attrValue);
      } else if (node.name === "iframe" && (attrKey === "sandbox" || attrKey === "allow")) {
        continue;
      } else if (node.name === "iframe" && attrKey === "srcdoc") {
        if (!(attrValue || "").trim()) {
          continue;
        }
        const nAttrValue = purifySrcDoc(attrValue);
        node.attrs[attrKey] = attrValue = nAttrValue;
        el.setAttribute(attrKey, attrValue);
      } else if (node.name === "object" && attrKey === "data") {
        el.setAttribute(attrKey, "about:blank");
      } else {
        if (node.name === "a") {
          if (attrKey === "href") {
            attrValue = "javascript:;";
          } else if (attrKey === "target") continue;
        }
        if (attrKey === "xlink:href") {
          el.setAttribute("href", attrValue === null ? "true" : attrValue);
        }
        el.setAttribute(attrKey, attrValue === null ? "true" : attrValue);
      }
    } catch {
      /* attr no aplicable */
    }
  }

  if (node.name === "style") {
    const cssRules = node.props.cssRules ?? node.attrs.cssRules;
    if (cssRules) el.textContent = String(cssRules);
  }

  if (node.props.isStylesheet) {
    if (node.attrs.href) {
      addToAssetLoadingPromises(el as HTMLLinkElement);
    }
  }

  if (node.name.toLowerCase() === "img") {
    el.setAttribute("loading", "eager");
  }

  if (node.name.toLowerCase() === "img" && shouldAddImgToAssetLoadingPromises) {
    addToAssetLoadingPromises(el as HTMLImageElement);
  }

  if (node.name.toLowerCase() === "img" && node.attrs.srcset && node.attrs.src && !node.attrs.src.startsWith("blob:")) {
    el.setAttribute("srcset", node.attrs.src);
  }

  if (node.props.isShadowHost && !el.shadowRoot) {
    el.attachShadow({ mode: "open" });
  }

  if (node.name.toLowerCase() === "body") {
    addPointerEventsAutoToEl(el as HTMLBodyElement);
  }

  function addToAssetLoadingPromises(element: HTMLLinkElement | HTMLImageElement): void {
    const p = new Promise((resolve) => {
      element.onload = resolve;
      element.onerror = resolve;
      element.onabort = resolve;
    });
    assetLoadingPromises.push(p);
  }

  return el;
};

export const deserFrame = async (
  docTree: SerNode,
  doc: Document,
  v: string,
  frameLoadingPromises: Promise<unknown>[],
  assetLoadingPromises: Promise<unknown>[],
  nestedFrames: HTMLIFrameElement[],
  shouldAddImgToAssetLoadingPromises = false,
): Promise<void> => {
  const rootHTMLEl = deser(
    docTree,
    doc,
    v,
    frameLoadingPromises,
    assetLoadingPromises,
    nestedFrames,
    { partOfSvgEl: 0, shadowParent: null },
    shouldAddImgToAssetLoadingPromises,
  ) as HTMLElement;
  const childNodes = doc.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    if (((childNodes[i] as unknown as Element).tagName || "").toLowerCase() === "html") {
      doc.replaceChild(rootHTMLEl, childNodes[i]);
      break;
    }
  }
};

export const deserIframeEl = (
  serNode: SerNode,
  doc: Document,
  version: string,
  frameLoadingPromises: Promise<unknown>[],
  assetLoadingPromises: Promise<unknown>[],
  nestedFrames: HTMLIFrameElement[] = [],
  props: DeSerProps = { partOfSvgEl: 0, shadowParent: null },
  shouldAddImgToAssetLoadingPromises = false,
): Node => {
  const iframeEl = deser(
    serNode,
    doc,
    version,
    frameLoadingPromises,
    assetLoadingPromises,
    nestedFrames,
    props,
    shouldAddImgToAssetLoadingPromises,
  );
  const tNode = iframeEl as HTMLIFrameElement;

  const htmlNode = serNode.chldrn.find((n) => n.type === Node.ELEMENT_NODE && n.name === "html");
  if (htmlNode) {
    const p = new Promise((resolve) => {
      tNode.onabort = () => {
        resolve(1);
      };
      tNode.onerror = () => {
        resolve(1);
      };
      tNode.onload = () => {
        const newDoc = tNode.contentDocument;
        if (newDoc) {
          deserFrame(htmlNode, newDoc, version, frameLoadingPromises, assetLoadingPromises, nestedFrames);
          nestedFrames.push(tNode);
        }
        resolve(1);
      };
    });
    frameLoadingPromises.push(p);
  }
  return tNode;
};

const stopEventBehaviour = (e: Event): void => {
  e.preventDefault();
  e.stopPropagation();
};

const deserCustomCssStyleSheets = (serNode: SerNode, doc: Document, node: Node): void => {
  const adopted = serNode.props.adoptedStylesheets;
  if (!adopted || !Array.isArray(adopted) || adopted.length === 0) return;

  const docToApplyCustomStyleSheets = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? (node as ShadowRoot) : doc;
  const win = doc.defaultView;
  if (!win) return;
  const sheets: CSSStyleSheet[] = [];
  (adopted as unknown as string[]).forEach((cssText) => {
    try {
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(cssText);
      sheets.push(sheet);
    } catch {
      /* hoja inválida */
    }
  });
  docToApplyCustomStyleSheets.adoptedStyleSheets = [...sheets];
};
