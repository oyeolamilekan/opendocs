// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotionPageEditor } from "./notion-page-editor";

vi.mock("./notion-editor", () => ({
  NotionEditor: vi.fn(
    ({ content, readOnly }: { content: unknown; readOnly?: boolean }) => (
      <div
        data-testid="notion-editor"
        data-content={JSON.stringify(content)}
        data-read-only={String(readOnly)}
      />
    ),
  ),
}));

afterEach(() => {
  cleanup();
});

const baseDraft = {
  title: "Getting started",
  endpointType: "doc" as const,
  editorType: "notion" as const,
  content: JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Welcome" }],
      },
    ],
  }),
  markdown: "",
  iconName: undefined,
  body: {
    description: "Learn the basics",
  },
};

describe("NotionPageEditor", () => {
  it("renders editable page title and description controls", () => {
    const onChange = vi.fn();
    render(
      <NotionPageEditor
        projectId={"project-id" as never}
        draft={baseDraft}
        canManage
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Page title"), {
      target: { value: "Quickstart" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...baseDraft,
      title: "Quickstart",
    });

    fireEvent.change(screen.getByLabelText("Page description"), {
      target: { value: "Updated description" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...baseDraft,
      body: {
        ...baseDraft.body,
        description: "Updated description",
      },
    });
  });

  it("passes read-only mode and safely handles malformed content", () => {
    const { getByLabelText, getByTestId } = render(
      <NotionPageEditor
        projectId={"project-id" as never}
        draft={{ ...baseDraft, content: "{not-json" }}
        canManage={false}
        onChange={vi.fn()}
      />,
    );

    expect((getByLabelText("Page title") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (getByLabelText("Page description") as HTMLTextAreaElement).disabled,
    ).toBe(true);
    expect(getByTestId("notion-editor").getAttribute("data-read-only")).toBe(
      "true",
    );
    expect(getByTestId("notion-editor").getAttribute("data-content")).toBe(
      "null",
    );
  });
});
