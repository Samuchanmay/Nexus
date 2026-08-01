import { deser, deserFrame, deserIframeEl } from "./deser";
import { getDiffsOfImmediateChildren, getSerNodesAttrUpdates, isSerNodeDifferent } from "./get-diffs";
import { applyFadeInTransitionToNode, applyUpdateDiff } from "./apply-diffs-anims";
import { scrollIframeEls } from "./scroll-util";
import { SCREEN_DIFFS_SUPPORTED_VERSION, type DeSerProps, type DiffsSerNode, type QueueNode, type SerNode, type SerScreen } from "./types";
import { getChildElementByFid, getFidOfSerNode, raiseDeferredError, sleep } from "./utils";

export function normalizeScreenData(json: unknown): SerScreen {
  if (!json || typeof json !== "object") {
    throw new Error("snapshot inválido");
  }
  const obj = json as Record<string, unknown>;
  let docTree: SerNode | null = null;
  if (obj.docTree && typeof obj.docTree === "object") {
    docTree = obj.docTree as SerNode;
  } else if (typeof obj.docTreeStr === "string") {
    try {
      docTree = JSON.parse(obj.docTreeStr) as SerNode;
    } catch {
      throw new Error("docTreeStr inválido");
    }
  }
  if (!docTree) {
    throw new Error("snapshot sin docTree");
  }
  const version = typeof obj.version === "string" ? obj.version : SCREEN_DIFFS_SUPPORTED_VERSION;
  return { version, docTree };
}

export class SerPlayer {
  private frameLoadingPromises: Promise<unknown>[] = [];
  private assetLoadingPromises: Promise<unknown>[] = [];
  private nestedFrames: HTMLIFrameElement[] = [];
  private currentTree: SerNode | null = null;
  private version = SCREEN_DIFFS_SUPPORTED_VERSION;
  private destroyed = false;
  private opQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly iframe: HTMLIFrameElement) {}

  destroy(): void {
    this.destroyed = true;
  }

  get loaded(): boolean {
    return this.currentTree !== null;
  }

  loadFirst(screen: SerScreen): Promise<void> {
    return this.runExclusive(() => this.loadFirstInternal(screen));
  }

  applyNext(screen: SerScreen): Promise<void> {
    return this.runExclusive(() => this.applyNextInternal(screen));
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(fn, fn);
    this.opQueue = run.catch(() => undefined);
    return run;
  }

  private async loadFirstInternal(screen: SerScreen): Promise<void> {
    const doc = this.iframe.contentDocument;
    if (!doc) throw new Error("iframe sin contentDocument");

    this.resetPromises();
    this.version = screen.version || SCREEN_DIFFS_SUPPORTED_VERSION;
    await deserFrame(
      screen.docTree,
      doc,
      this.version,
      this.frameLoadingPromises,
      this.assetLoadingPromises,
      this.nestedFrames,
    );
    await Promise.race([this.waitForLoads(), sleep(5000)]);
    if (this.destroyed) return;

    const body = doc.body as HTMLElement | null;
    if (body) body.setAttribute("dxdy", "0,0");
    await scrollIframeEls(this.version, doc);
    this.currentTree = screen.docTree;
  }

  private async applyNextInternal(screen: SerScreen): Promise<void> {
    if (!this.currentTree) return this.loadFirstInternal(screen);

    const doc = this.iframe.contentDocument;
    if (!doc) throw new Error("iframe sin contentDocument");

    const versionChanged = this.version !== screen.version;
    const rootChanged = isSerNodeDifferent(this.currentTree, screen.docTree);

    if (versionChanged || rootChanged) {
      this.resetPromises();
      this.version = screen.version || this.version;
      await deserFrame(
        screen.docTree,
        doc,
        this.version,
        this.frameLoadingPromises,
        this.assetLoadingPromises,
        this.nestedFrames,
      );
      await Promise.race([this.waitForLoads(), sleep(5000)]);
      if (this.destroyed) return;

      const body = doc.body as HTMLElement | null;
      if (body) body.setAttribute("dxdy", "0,0");
      await scrollIframeEls(this.version, doc);
      this.currentTree = screen.docTree;
      return;
    }

    const ok = await this.getAndApplyDiffs(this.currentTree, screen.docTree, doc, this.version);
    if (ok) this.currentTree = screen.docTree;
  }

  private resetPromises(): void {
    this.frameLoadingPromises = [];
    this.assetLoadingPromises = [];
    this.nestedFrames = [];
  }

  private deserElOrIframeEl = (
    serNode: SerNode,
    doc: Document,
    version: string,
    props: DeSerProps = { partOfSvgEl: 0, shadowParent: null },
  ): Node => {
    if (serNode.name === "iframe" || serNode.name === "object") {
      return deserIframeEl(
        serNode,
        doc,
        version,
        this.frameLoadingPromises,
        this.assetLoadingPromises,
        this.nestedFrames,
        props,
      )!;
    }
    return deser(
      serNode,
      doc,
      version,
      this.frameLoadingPromises,
      this.assetLoadingPromises,
      this.nestedFrames,
      props,
    )!;
  };

  private getAndApplyDiffs = async (tree1: SerNode, tree2: SerNode, doc: Document, version: string): Promise<boolean> => {
    try {
      const htmlEl = doc.documentElement;
      const updates = getSerNodesAttrUpdates(tree1, tree2);
      applyUpdateDiff(updates, htmlEl);

      const queue: QueueNode[] = [{
        serNodeOfTree1: tree1,
        node1: doc.documentElement,
        serNodeOfTree2: tree2,
        props: {
          partOfSvgEl: 0,
          shadowParent: null,
        },
      }];

      while (queue.length > 0) {
        const { serNodeOfTree1, node1, serNodeOfTree2, props } = queue.shift()!;

        const diffs = getDiffsOfImmediateChildren(
          { serNode: serNodeOfTree1, props },
          { serNode: serNodeOfTree2, props },
        );

        await this.applyDiffsToDom(node1, serNodeOfTree2, diffs, doc, version, props);

        const commonNodes = diffs.commonNodes;
        for (let i = 0; i <= commonNodes.length - 1; i++) {
          const commonNode = commonNodes[i];

          let parentNode = node1 as Node;
          if (node1.nodeName.toLowerCase() === "iframe") {
            const contentDoc = (node1 as HTMLIFrameElement).contentDocument;
            if (!contentDoc) continue;
            parentNode = contentDoc as Node;
          }

          let node: HTMLElement | ShadowRoot | null = getChildElementByFid(
            parentNode,
            getFidOfSerNode(commonNode.serNodeOfTree1),
          ) as HTMLElement | null;

          if (commonNode.serNodeOfTree1.type === Node.DOCUMENT_FRAGMENT_NODE) {
            node = (parentNode as HTMLElement).shadowRoot as ShadowRoot;
          }

          if (node) {
            queue.push({
              serNodeOfTree1: commonNode.serNodeOfTree1,
              serNodeOfTree2: commonNode.serNodeOfTree2,
              node1: node,
              props: {
                partOfSvgEl: props.partOfSvgEl || commonNode.serNodeOfTree1.name.toLowerCase() === "svg" ? 1 : 0,
                shadowParent: null,
              },
            });
          }
        }
      }

      return true;
    } catch (e) {
      raiseDeferredError((e as Error).message);
      return false;
    }
  };

  private applyDiffsToDom = async (
    node: Node,
    serNodeInTree2: SerNode,
    diffs: DiffsSerNode,
    doc: Document,
    version: string,
    props: DeSerProps,
  ): Promise<void> => {
    if (node.nodeName.toLowerCase() === "head") {
      deletePrependStylesFromHead(node);
    }

    if (diffs.shouldReplaceNode) {
      const newNode = this.deserElOrIframeEl(serNodeInTree2, doc, version, props)!;
      await this.replaceNode(newNode, node.parentNode, node);
      return;
    }

    let parentNode = node;
    if (node.nodeName.toLowerCase() === "iframe") {
      const contentDoc = (node as HTMLIFrameElement).contentDocument;
      if (contentDoc) parentNode = contentDoc as Node;
    }

    diffs.deletedNodes.forEach((diff) => {
      const el = getChildElementByFid(parentNode, diff.fid);
      if (el) {
        if (diff.isTextComment) {
          const nextSibling = el.nextSibling;
          if (nextSibling) nextSibling.remove();
        }
        el.remove();
      }
    });

    diffs.addedNodes.reverse().forEach((diff) => {
      const addedNode = this.deserElOrIframeEl(diff.addedNode, doc, version, diff.props)!;
      const originalOpacity = getOriginalOpacity(addedNode);
      setOpacityOfNode(addedNode, "0");
      let nextEl = getChildElementByFid(parentNode, diff.nextFid) as Node | null;
      if (diff.textNode) {
        const textNode = this.deserElOrIframeEl(diff.textNode, doc, version, diff.props);
        parentNode.insertBefore(textNode, nextEl);
        nextEl = textNode;
      }
      parentNode.insertBefore(addedNode, nextEl);
      applyFadeInTransitionToNode(addedNode, originalOpacity);
    });

    diffs.updatedNodes.forEach((diff) => {
      const el = getChildElementByFid(parentNode, diff.fid);
      if (el) applyUpdateDiff(diff.updates, el);
    });

    for (const diff of diffs.replaceNodes) {
      const nodeToReplace = getChildElementByFid(parentNode, diff.fid) as HTMLElement;
      if (!nodeToReplace) continue;
      const newNode = this.deserElOrIframeEl(diff.serNode, doc, version, diff.props)!;
      await this.replaceNode(newNode, parentNode, nodeToReplace);
    }

    await Promise.race([
      this.waitForLoads(),
      sleep(3000),
    ]);
  };

  private replaceNode = async (newNode: Node, parentNode: Node | null, nextNode: Node): Promise<void> => {
    if (newNode.nodeName.toLowerCase() === "link" && parentNode) {
      parentNode.insertBefore(newNode, nextNode);
      await Promise.race([
        this.waitForLoads(),
        sleep(3000),
      ]);
      (nextNode as HTMLElement).remove();
    } else {
      (nextNode as HTMLElement).replaceWith(newNode);
    }
  };

  private waitForLoads = async (): Promise<void> => {
    while (this.frameLoadingPromises.length) {
      await this.frameLoadingPromises.shift();
    }
    while (this.assetLoadingPromises.length) {
      await this.assetLoadingPromises.shift();
    }
  };
}

function getOriginalOpacity(htmlNode: Node): string {
  let originalOpacity = "1";
  if (htmlNode.nodeType === Node.ELEMENT_NODE) {
    originalOpacity = getComputedStyle(htmlNode as Element).opacity;
  }
  return originalOpacity;
}

function setOpacityOfNode(htmlNode: Node, opacity: string): void {
  if (htmlNode.nodeType === Node.ELEMENT_NODE) {
    (htmlNode as HTMLElement).style.opacity = opacity;
  }
}

function deletePrependStylesFromHead(head: Node): void {
  for (let i = head.childNodes.length - 1; i >= 0; i--) {
    const currNode = head.childNodes[i] as Element;
    if (currNode.nodeType !== Node.TEXT_NODE
      && currNode.nodeType !== Node.COMMENT_NODE
      && !currNode.getAttribute("f-id")
      && currNode.getAttribute("data-rc-order") === "prependQueue") {
      currNode.remove();
    }
  }
}
