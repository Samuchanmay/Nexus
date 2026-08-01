import { SCREEN_DIFFS_SUPPORTED_VERSION } from "./types";

export function scrollIframeEls(version: string, doc: Document): Promise<void> {
  return new Promise((resolve) => {
    switch (version) {
      case SCREEN_DIFFS_SUPPORTED_VERSION:
      case "2023-01-10": {
        const allDocEls = doc.querySelectorAll("*");
        for (let i = 0; i < allDocEls.length; i++) {
          const el = allDocEls[i];
          if (el.nodeName.toLowerCase() === "iframe") {
            const iframeEl = el as HTMLIFrameElement;
            const contentDoc = iframeEl.contentDocument;
            if (contentDoc) scrollIframeEls(version, contentDoc);
          }
          const scrollTopFactor = allDocEls[i].getAttribute("fable-stf") || "0";
          const scrollLeftFactor = allDocEls[i].getAttribute("fable-slf") || "0";
          const scrollTop = parseFloat(scrollTopFactor) * (el.scrollHeight - el.clientHeight);
          const scrollLeft = parseFloat(scrollLeftFactor) * (el.scrollWidth - el.clientWidth);
          el.scroll({ top: scrollTop, left: scrollLeft });
        }
        break;
      }
      default:
        break;
    }
    setTimeout(() => resolve(), 0);
  });
}
