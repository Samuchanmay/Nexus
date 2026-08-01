import type { SerNode } from "./types";

export function nanoid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  const stack: { obj1: unknown; obj2: unknown }[] = [{ obj1, obj2 }];
  const seen = new WeakMap<object, Set<object>>();
  while (stack.length > 0) {
    const pair = stack.pop();
    if (!pair) continue;
    const { obj1: o1, obj2: o2 } = pair;
    if (o1 === o2) continue;
    if (typeof o1 !== "object" || typeof o2 !== "object" || o1 === null || o2 === null) return false;
    if (Array.isArray(o1) !== Array.isArray(o2)) return false;
    const seenFor1 = seen.get(o1);
    if (seenFor1?.has(o2)) continue;
    if (seenFor1) seenFor1.add(o2);
    else seen.set(o1, new Set([o2]));
    const k1 = Object.keys(o1 as Record<string, unknown>);
    const k2 = Object.keys(o2 as Record<string, unknown>);
    if (k1.length !== k2.length) return false;
    for (const k of k1) {
      if (!Object.prototype.hasOwnProperty.call(o2, k)) return false;
      stack.push({ obj1: (o1 as Record<string, unknown>)[k], obj2: (o2 as Record<string, unknown>)[k] });
    }
  }
  return true;
}

export function removeDuplicatesOfStrArr(arr: string[]): string[] {
  return [...new Set(arr)];
}

export function getFidOfSerNode(node: SerNode): string | null {
  if (node.type === 8 && node.name === "#comment") {
    return String(node.props.textContent ?? "").split("==")[0].split("/")[1] ?? null;
  }
  return node.attrs["f-id"] ?? null;
}

export function getFidOfNode(node: Node): string | null {
  if (node.nodeType === 8) {
    return (node as Comment).textContent?.split("==")[0].split("/")[1] ?? null;
  }
  return (node as HTMLElement).getAttribute?.("f-id") ?? null;
}

export function getChildElementByFid(node: Node | ShadowRoot, fid: string | null | undefined): Element | null {
  if (!fid) return null;
  const children = Array.from(node.childNodes);
  return children.find((child) => getFidOfNode(child) === fid) as Element | null;
}

export function addPointerEventsAutoToEl(el: HTMLElement) {
  const str = el.getAttribute("style") ?? "";
  const newStr = str.endsWith(";") ? `${str} pointer-events: auto !important;` : `${str}; pointer-events: auto !important;`;
  el.setAttribute("style", newStr);
}

export function getUrlsFromSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function isHTTPS(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTimerPromise<T>(fn: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => fn(resolve, reject), ms);
  });
}

export function getOriginalOpacity(el: HTMLElement | null): string {
  if (el) {
    const attribute = el.getAttribute("data-fable-opacity");
    if (attribute) return attribute;
    const computed = el.ownerDocument?.defaultView?.getComputedStyle(el).opacity;
    return computed || "0.8";
  }
  return "0.8";
}

export function raiseDeferredError(message: string) {
  console.warn("[recorridos]", message);
}
