// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  AiMessageContent,
  AiMessageReferences,
} from "./ai-message-content";

function message(text: string): UIMessage {
  return {
    id: "message-1",
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

describe("AiMessageContent", () => {
  it("renders common inline Markdown formatting", () => {
    render(
      <AiMessageContent
        message={message(
          "Use **Bearer authentication** with `Authorization` and *keep it secret*.",
        )}
      />,
    );

    expect(screen.getByText("Bearer authentication").tagName).toBe("STRONG");
    expect(screen.getByText("Authorization").tagName).toBe("CODE");
    expect(screen.getByText("keep it secret").tagName).toBe("EM");
  });

  it("renders Markdown formatting inside list items", () => {
    render(
      <AiMessageContent
        message={message(
          "- **POST** `/transactions`\n- Read the [API guide](/guides/start.md)",
        )}
      />,
    );

    expect(screen.getByText("POST").tagName).toBe("STRONG");
    expect(screen.getByText("/transactions").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "API guide" }).getAttribute("href"))
      .toBe("/guides/start");
  });

  it("renders strong formatting around inline code without visible markers", () => {
    render(
      <AiMessageContent
        message={message("**`POST /transactions`**")}
      />,
    );

    const code = screen.getByText("POST /transactions");
    expect(code.tagName).toBe("CODE");
    expect(code.parentElement?.tagName).toBe("STRONG");
    expect(screen.queryByText("**", { exact: false })).toBeNull();
  });

  it("renders Markdown tables as responsive semantic tables", () => {
    render(
      <AiMessageContent
        message={message(
          "| Parameter | Type | Description |\n|---|---|---|\n| `amount` | string | Amount of fiat |\n| `currency` | string | Currency code |",
        )}
      />,
    );

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Parameter" })).toBeTruthy();
    expect(screen.getByText("amount").tagName).toBe("CODE");
    expect(screen.getByText("Currency code")).toBeTruthy();
  });

  it("renders referenced documentation before the response content", () => {
    const referencedMessage = {
      id: "message-with-reference",
      role: "assistant",
      parts: [
        {
          type: "tool-getDocumentationPage",
          state: "output-available",
          output: {
            source: {
              title: "Create transaction",
              type: "reference",
              url: "https://payments.example.com/reference/create-transaction",
            },
          },
        },
        { type: "text", text: "Use the transaction endpoint." },
      ],
    } as unknown as UIMessage;

    render(<AiMessageReferences message={referencedMessage} />);

    expect(screen.getByText("Referenced documentation")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Create transaction/ });
    expect(link.getAttribute("href")).toBe(
      "https://payments.example.com/reference/create-transaction",
    );
    expect(link.getAttribute("target")).toBeNull();
  });

  it("opens inline documentation citations in app", () => {
    render(
      <AiMessageContent
        message={message(
          "See [Create transaction](https://payments.example.com/reference/create-transaction).",
        )}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Create transaction" }).getAttribute(
        "target",
      ),
    ).toBeNull();
  });
});
