// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  extractRichContentHeadings,
  RichContentRenderer,
} from "./rich-content-renderer";

describe("RichContentRenderer", () => {
  it("extracts public documentation headings with stable unique ids", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Getting Started" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Intro copy." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Getting Started" }],
        },
      ],
    });

    expect(extractRichContentHeadings(content)).toEqual([
      { id: "getting-started", text: "Getting Started", level: 2 },
      { id: "getting-started-2", text: "Getting Started", level: 3 },
    ]);
  });

  it("ignores invalid or plain text content when extracting headings", () => {
    expect(extractRichContentHeadings("Plain guide content")).toEqual([]);
    expect(extractRichContentHeadings(null)).toEqual([]);
  });

  it("adds matching ids to rendered public documentation headings", () => {
    const { container } = render(
      <RichContentRenderer
        content={JSON.stringify({
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Install SDK" }],
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "Install SDK" })).toBeTruthy();
    expect(container.querySelector("#install-sdk")).toBeTruthy();
  });

  it("renders stored TipTap tables in public documentation", () => {
    render(
      <RichContentRenderer
        content={JSON.stringify({
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
                          content: [{ type: "text", text: "Header" }],
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
                          content: [{ type: "text", text: "Cell" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Header")).toBeTruthy();
    expect(screen.getByText("Cell")).toBeTruthy();
  });
});
