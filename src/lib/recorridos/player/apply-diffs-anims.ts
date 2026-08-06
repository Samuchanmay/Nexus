import { addPointerEventsAutoToEl } from "./utils";
import { purifySrcDoc } from "./deser";
import type { Update } from "./types";

export const applyFadeInTransitionToNode = (node: Node, originialOpacity: string): void => {
  if (node.nodeType === 1) {
    const element = node as HTMLElement;
    element.style.opacity = "0";
    element.style.transform = "translateY(-8px)";
    element.style.transition = "opacity 0.35s ease-out, transform 0.35s ease-out";
    const timer = setTimeout(() => {
      element.style.opacity = originialOpacity;
      element.style.transform = "translateY(0)";
      clearTimeout(timer);
    }, 40);
    const clearTimer = setTimeout(() => {
      element.style.transition = "";
      element.style.transform = "";
      clearTimeout(clearTimer);
    }, 450);
  }
};

export function applyUpdateDiff(updates: Update[], el: Node): void {
  if (el && el.nodeType === Node.ELEMENT_NODE) {
    updates.forEach((update) => {
      if (update.attrKey === "style") {
        const allStyles = update.attrNewVal.split(";").filter((prop) => !prop.match(/\s*transition/));
        update.attrNewVal = allStyles.join(" ; ");
      }
      if (update.shouldRemove) {
        (el as Element).removeAttribute(update.attrKey);
      } else {
        if (el.nodeName && el.nodeName.toLowerCase && el.nodeName.toLowerCase() === "iframe" && update.attrKey === "srcdoc") {
          update.attrNewVal = purifySrcDoc(update.attrNewVal);
        }
        (el as Element).setAttribute(update.attrKey, update.attrNewVal);
      }
    });
    (el as HTMLElement).style.transition = "all 0.3s ease-out";
    if (el.nodeName.toLowerCase() === "body") {
      addPointerEventsAutoToEl(el as HTMLBodyElement);
    }
  }
}
