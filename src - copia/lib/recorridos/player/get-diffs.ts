import { FABLE_CUSTOM_NODE, type DiffsSerNode, type DeSerProps, type SerNode, type Update } from "./types";
import { getFidOfSerNode, isDeepEqual, removeDuplicatesOfStrArr } from "./utils";

type DiffQueueNode = {
  serNode: SerNode;
  props: DeSerProps;
};

export const getDiffsOfImmediateChildren = (node1: DiffQueueNode, node2: DiffQueueNode): DiffsSerNode => {
  const diffs: DiffsSerNode = {
    addedNodes: [],
    deletedNodes: [],
    updatedNodes: [],
    commonNodes: [],
    replaceNodes: [],
    shouldReplaceNode: false,
    nodeProps: {
      partOfSvgEl: 0,
      shadowParent: null,
    },
  };

  if (isSerNodeReordered(node1.serNode, node2.serNode)) {
    diffs.shouldReplaceNode = true;
    return diffs;
  }

  if (isFidRepeated(node1.serNode) || isFidRepeated(node2.serNode)) {
    diffs.shouldReplaceNode = true;
    return diffs;
  }

  if (node1.serNode.type !== node2.serNode.type) {
    diffs.shouldReplaceNode = true;
    return diffs;
  }

  if (node1.serNode.name.toLowerCase() === "svg") diffs.nodeProps.partOfSvgEl = 1;

  const mapOfTree1 = new Map<string | null, SerNode>();
  node1.serNode.chldrn.forEach((node) => {
    if (node.name.toLowerCase() !== "#text" && (node.type === Node.COMMENT_NODE || node.type === Node.ELEMENT_NODE)) {
      const fid = getFidOfSerNode(node);
      mapOfTree1.set(fid, node);
    }
  });

  for (let i = 0; i <= node2.serNode.chldrn.length - 1; i++) {
    const serNodeInTree2 = node2.serNode.chldrn[i];
    const currFid = getFidOfSerNode(serNodeInTree2);

    if (serNodeInTree2.type === Node.DOCUMENT_FRAGMENT_NODE) {
      const shadowRootInSerNodeTree1 = node1.serNode.chldrn.find((node) => node.type === Node.DOCUMENT_FRAGMENT_NODE);
      if (shadowRootInSerNodeTree1) {
        diffs.commonNodes.push({
          serNodeOfTree1: shadowRootInSerNodeTree1,
          serNodeOfTree2: serNodeInTree2,
        });
      }
      continue;
    }

    if (!mapOfTree1.has(currFid)) {
      if (serNodeInTree2.type !== Node.COMMENT_NODE && serNodeInTree2.type !== Node.ELEMENT_NODE) {
        if (
          serNodeInTree2.type !== Node.TEXT_NODE
          && serNodeInTree2.type !== FABLE_CUSTOM_NODE
          && serNodeInTree2.type !== Node.DOCUMENT_TYPE_NODE
          && serNodeInTree2.type !== Node.DOCUMENT_FRAGMENT_NODE
        ) {
          diffs.shouldReplaceNode = true;
          diffs.commonNodes = [];
          return diffs;
        }
        continue;
      }

      let textNode: SerNode | null = null;

      if (serNodeInTree2.type === Node.COMMENT_NODE && String(serNodeInTree2.props.textContent ?? "").includes("textfid/")) {
        textNode = node2.serNode.chldrn[i + 1];
        i += 1;
      }

      diffs.addedNodes.push({
        addedNode: serNodeInTree2,
        nextFid: getFidOfSerNode(node2.serNode.chldrn[i + 1]) ?? "",
        textNode,
        props: {
          partOfSvgEl: node2.props.partOfSvgEl || serNodeInTree2.name.toLowerCase() === "svg" ? 1 : 0,
          shadowParent: null,
        },
      });
    } else {
      const serNodeInTree1 = mapOfTree1.get(currFid)!;

      const updates = getSerNodesAttrUpdates(serNodeInTree1, serNodeInTree2);
      if (updates.length > 0) {
        diffs.updatedNodes.push({
          fid: currFid!,
          updates,
        });
      }

      const shouldReplaceChildNode = areSerNodePropsDifferent(serNodeInTree1, serNodeInTree2)
        || isAssetChanged(serNodeInTree1, serNodeInTree2);
      if (shouldReplaceChildNode) {
        diffs.replaceNodes.push({
          fid: currFid!,
          serNode: serNodeInTree2,
          props: {
            partOfSvgEl: node2.props.partOfSvgEl || serNodeInTree2.name.toLowerCase() === "svg" ? 1 : 0,
            shadowParent: null,
          },
        });
      }

      if (!shouldReplaceChildNode) {
        diffs.commonNodes.push({
          serNodeOfTree1: serNodeInTree1,
          serNodeOfTree2: serNodeInTree2,
        });
      }

      mapOfTree1.delete(currFid);
    }
  }

  diffs.deletedNodes = Array.from(mapOfTree1.entries()).map(([fid, serNode]) => {
    let isTextComment = false;
    if (serNode.type === Node.COMMENT_NODE && String(serNode.props.textContent ?? "").includes("textfid/")) {
      isTextComment = true;
    }
    return {
      fid: fid ?? "",
      isTextComment,
    };
  });

  return diffs;
};

function isFidRepeated(tree: SerNode): boolean {
  const map = new Map<string | null, boolean>();
  for (const child of tree.chldrn) {
    const fid = getFidOfSerNode(child);
    if (child.type !== Node.TEXT_NODE && map.has(fid)) {
      return true;
    }
    map.set(fid, true);
  }
  return false;
}

function isSerNodeReordered(tree1: SerNode, tree2: SerNode): boolean {
  let tree1Fids: (string | null)[] = [];
  const tree2Fids: (string | null)[] = [];

  tree1.chldrn.forEach((serNode) => {
    if (serNode.type === Node.ELEMENT_NODE || serNode.type === Node.COMMENT_NODE) {
      const fid = getFidOfSerNode(serNode);
      tree1Fids.push(fid);
    }
  });

  tree2.chldrn.forEach((serNode) => {
    if (serNode.type === Node.ELEMENT_NODE || serNode.type === Node.COMMENT_NODE) {
      const fid = getFidOfSerNode(serNode);
      if (tree1Fids.includes(fid)) {
        tree2Fids.push(fid);
      }
    }
  });

  tree1Fids = tree1Fids.filter((fid) => tree2Fids.includes(fid));

  for (let i = 0; i < tree1Fids.length; i++) {
    if (tree1Fids[i] !== tree2Fids[i]) {
      return true;
    }
  }

  return false;
}

export const isAssetChanged = (serNodeOfTree1: SerNode, serNodeOfTree2: SerNode): boolean => {
  const assetsToBeChecked = [
    { name: "link", attr: "href" },
    { name: "iframe", attr: "src" },
  ];

  for (const assetToCheck of assetsToBeChecked) {
    if (serNodeOfTree1.name.toLowerCase() === assetToCheck.name
      && serNodeOfTree2.name.toLowerCase() === assetToCheck.name) {
      if (serNodeOfTree1.attrs[assetToCheck.attr] !== serNodeOfTree2.attrs[assetToCheck.attr]) {
        return true;
      }
    }
  }

  return false;
};

export const getSerNodesAttrUpdates = (serNodeOfTree1: SerNode, serNodeOfTree2: SerNode): Update[] => {
  const updates: Update[] = [];
  const updatesToSkip = [
    { name: "link", attr: "href" },
    { name: "iframe", attr: "src" },
  ];
  const keysOfNode1 = Object.keys(serNodeOfTree1.attrs);
  const keysOfNode2 = Object.keys(serNodeOfTree2.attrs);

  let keys = removeDuplicatesOfStrArr([...keysOfNode1, ...keysOfNode2]);

  if (serNodeOfTree1.name === "canvas" && serNodeOfTree2.name === "canvas") {
    keys = keys.filter((key) => key !== "src");
  }
  for (const key of keys) {
    if (serNodeOfTree1.attrs[key] !== serNodeOfTree2.attrs[key]) {
      if (!shouldSkipUpdate(key)) {
        updates.push({
          attrKey: key,
          attrOldVal: serNodeOfTree1.attrs[key] ?? "",
          attrNewVal: serNodeOfTree2.attrs[key] ?? "",
          shouldRemove: serNodeOfTree2.attrs[key] === undefined,
        });
      }
    }
  }
  return updates;

  function shouldSkipUpdate(key: string): boolean {
    for (const updateToSkip of updatesToSkip) {
      if (serNodeOfTree1.name === updateToSkip.name
        && serNodeOfTree2.name === updateToSkip.name
        && key === updateToSkip.attr) {
        return true;
      }
    }
    return false;
  }
};

export const areSerNodePropsDifferent = (serNodeOfTree1: SerNode, serNodeOfTree2: SerNode): boolean => {
  const keysOfNode1 = Object.keys(serNodeOfTree1.props);
  const keysOfNode2 = Object.keys(serNodeOfTree2.props);

  const keys = removeDuplicatesOfStrArr([...keysOfNode1, ...keysOfNode2]);

  if (serNodeOfTree1.name === "canvas" && serNodeOfTree2.name === "canvas") {
    if (serNodeOfTree1.attrs.src !== serNodeOfTree2.attrs.src) {
      return true;
    }
  }

  if (serNodeOfTree1.chldrn.length > 300 && serNodeOfTree1.name !== "head") {
    return true;
  }

  return !isDeepEqual(serNodeOfTree1.props, serNodeOfTree2.props);
};

export const isSerNodeDifferent = (tree1: SerNode, tree2: SerNode): boolean => {
  return tree1.attrs["f-id"] !== tree2.attrs["f-id"] || areSerNodePropsDifferent(tree1, tree2);
};
