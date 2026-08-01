export const FABLE_CUSTOM_NODE = -1;
export const SCREEN_DIFFS_SUPPORTED_VERSION = "2023-07-27";

export type SerNode = {
  type: number;
  name: string;
  attrs: Record<string, string>;
  props: Record<string, string | number | boolean>;
  chldrn: SerNode[];
  sv: number;
};

export type SerDoc = {
  sv: number;
  docTreeStr: string;
};

export type SerScreen = {
  version: string;
  docTree: SerNode;
};

export type DeSerProps = {
  partOfSvgEl: number;
  shadowRoot?: ShadowRoot;
  shadowParent: ShadowRoot | null;
};

export type AddDiff = {
  addedNode: SerNode;
  nextFid: string;
  textNode: SerNode | null;
  props: DeSerProps;
};

export type DelDiff = {
  fid: string;
  isTextComment: boolean;
};

export type Update = {
  attrKey: string;
  attrOldVal: string;
  attrNewVal: string;
  shouldRemove: boolean;
};

export type UpdateDiff = {
  fid: string;
  updates: Update[];
};

export type CommonNode = {
  serNodeOfTree1: SerNode;
  serNodeOfTree2: SerNode;
};

export type ReplaceDiff = {
  fid: string;
  serNode: SerNode;
  props: DeSerProps;
};

export type DiffsSerNode = {
  addedNodes: AddDiff[];
  deletedNodes: DelDiff[];
  updatedNodes: UpdateDiff[];
  commonNodes: CommonNode[];
  replaceNodes: ReplaceDiff[];
  shouldReplaceNode: boolean;
  nodeProps: DeSerProps;
};

export type QueueNode = {
  serNodeOfTree1: SerNode;
  node1: Node | ShadowRoot;
  serNodeOfTree2: SerNode;
  props: DeSerProps;
};
