import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeTabsNodeView } from "../components/code-tabs";

export const CodeTabsExtension = Node.create({
  name: "codeTabs",
  group: "block",
  atom: true,
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      tabs: {
        default: [],
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-code-tabs]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-code-tabs": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeTabsNodeView);
  },
});
