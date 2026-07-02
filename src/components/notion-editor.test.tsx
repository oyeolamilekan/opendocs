// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NotionEditor, reorderBlocks } from "./notion-editor";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

beforeAll(() => {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => document.body,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
});

describe("NotionEditor", () => {
  it("reorders blocks without changing their contents", () => {
    expect(reorderBlocks(["first", "second", "third"], 0, 2)).toEqual([
      "second",
      "third",
      "first",
    ]);
    expect(reorderBlocks(["first", "second", "third"], 2, 0)).toEqual([
      "third",
      "first",
      "second",
    ]);
  });

  it("mounts with the TipTap editor content", async () => {
    render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Editor content" }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Editor content")).toBeTruthy();
  });

  it("shows block actions on hover and deletes a block", async () => {
    const onChange = vi.fn();
    render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Delete this block" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Keep this block" }],
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    const block = await screen.findByText("Delete this block");
    fireEvent.mouseMove(block);
    const blockActions = screen.getByRole("button", {
      name: "Block actions",
    });
    fireEvent.pointerDown(blockActions, { button: 0, ctrlKey: false });
    expect(screen.queryByRole("menuitem", { name: "Delete Block" })).toBeNull();
    fireEvent.click(blockActions);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete Block" }),
    );

    expect(screen.queryByText("Delete this block")).toBeNull();
    expect(screen.getByText("Keep this block")).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it("drags a block from the gutter and reorders editor content", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First block" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Second block" }],
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    const firstBlock = await screen.findByText("First block");
    const secondBlock = screen.getByText("Second block");
    const editorContainer = container.querySelector(".notion-editor");
    expect(editorContainer).toBeTruthy();

    vi.spyOn(editorContainer!, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      left: 0,
      right: 600,
      width: 600,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(firstBlock, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 20,
      left: 40,
      right: 600,
      width: 560,
      height: 20,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(secondBlock, "getBoundingClientRect").mockReturnValue({
      top: 30,
      bottom: 50,
      left: 40,
      right: 600,
      width: 560,
      height: 20,
      x: 40,
      y: 30,
      toJSON: () => ({}),
    });

    fireEvent.mouseMove(firstBlock);
    const blockActions = screen.getByRole("button", {
      name: "Block actions",
    });
    fireEvent.pointerDown(blockActions, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    expect(screen.queryByRole("menuitem", { name: "Delete Block" })).toBeNull();
    fireEvent.pointerMove(blockActions, {
      pointerId: 1,
      clientX: 10,
      clientY: 55,
    });
    expect(firstBlock.classList.contains("is-block-dragging")).toBe(true);
    expect(document.querySelector(".notion-block-drag-preview")).toBeTruthy();
    fireEvent.pointerUp(blockActions, {
      pointerId: 1,
      clientX: 10,
      clientY: 55,
    });
    expect(screen.queryByRole("menuitem", { name: "Delete Block" })).toBeNull();
    expect(firstBlock.classList.contains("is-block-dragging")).toBe(false);
    expect(document.querySelector(".notion-block-drag-preview")).toBeNull();

    await waitFor(() => {
      const latestChange = onChange.mock.calls.at(-1)?.[0];
      expect(latestChange?.content?.map((block: any) => block.content?.[0]?.text))
        .toEqual(["Second block", "First block"]);
    });
  });

  it("renders stored image nodes", async () => {
    render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "https://example.com/image.png",
                alt: "Documentation diagram",
              },
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByAltText("Documentation diagram")).toBeTruthy();
  });

  it("renders stored tabbed code with language controls", async () => {
    render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "codeTabs",
              attrs: {
                tabs: [
                  {
                    id: "javascript-example",
                    name: "JavaScript",
                    language: "javascript",
                    code: "const answer = 42;",
                  },
                ],
              },
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("tab", { name: "JavaScript" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", {
        name: "JavaScript code",
      }) as HTMLTextAreaElement).value,
    ).toBe("const answer = 42;");
    expect(
      screen.getByRole("button", { name: "Configure JavaScript" }),
    ).toBeTruthy();
  });

  it("renders stored tables", async () => {
    render(
      <NotionEditor
        projectId={"test-project" as never}
        content={{
          type: "doc",
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    {
                      type: "tableHeader",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Name" }],
                        },
                      ],
                    },
                    {
                      type: "tableHeader",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Value" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "tableRow",
                  content: [
                    {
                      type: "tableCell",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Region" }],
                        },
                      ],
                    },
                    {
                      type: "tableCell",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Lagos" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Lagos")).toBeTruthy();
  });
});
