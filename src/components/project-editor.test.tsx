// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  createEndpointDraft,
  draftForEndpointType,
  EndpointFieldEditor,
  getFirstEndpointSlug,
  getFirstGuidePageSlug,
  optionsWithCurrentValue,
  PROJECT_DOCUMENTATION_AREAS,
  RawRequestBodyImportModal,
  reorderEndpointItems,
  reorderSectionItems,
  statusOptionsWithCurrentValue,
  useEndpointDraft,
} from "./project-editor";
import { setNestedRequestValue } from "../lib/request-values";

afterEach(() => {
  cleanup();
});

function endpoint(
  overrides: Partial<Doc<"apiEndpoints">> = {},
): Doc<"apiEndpoints"> {
  return {
    _id: "endpoint-id" as Id<"apiEndpoints">,
    _creationTime: 1,
    projectId: "project-id" as Id<"apiProjects">,
    sectionId: "section-id" as Id<"apiSections">,
    title: "Get user",
    slug: "get-user",
    endpointType: "endpoint",
    body: {
      method: "GET",
      path: "/users/{id}",
      description: "Get a user",
      parameters: [],
      requestBody: [],
      authHeader: { type: "none", key: "", value: "" },
      sampleResponses: [],
    },
    position: 0,
    updatedAt: 10,
    ...overrides,
  };
}

describe("useEndpointDraft", () => {
  it("preserves local edits when Convex returns an equivalent new object", async () => {
    const initial = endpoint();
    const { result, rerender } = renderHook(
      ({ value }) => useEndpointDraft(value, value.slug),
      { initialProps: { value: initial } },
    );

    await waitFor(() => expect(result.current.draft).not.toBeNull());
    expect(result.current.draftEndpointId).toBe(initial._id);
    act(() => {
      result.current.setDraft({
        ...result.current.draft!,
        title: "Edited title",
      });
    });

    rerender({ value: { ...initial, body: { ...initial.body } } });

    expect(result.current.draft?.title).toBe("Edited title");
  });

  it("loads a persisted server update", async () => {
    const initial = endpoint();
    const { result, rerender } = renderHook(
      ({ value }) => useEndpointDraft(value, value.slug),
      { initialProps: { value: initial } },
    );

    await waitFor(() => expect(result.current.draft).not.toBeNull());
    rerender({
      value: endpoint({ title: "Persisted title", updatedAt: 11 }),
    });

    await waitFor(() =>
      expect(result.current.draft?.title).toBe("Persisted title"),
    );
    expect(result.current.draftEndpointId).toBe(initial._id);
  });

  it("clears the resolved draft while a different endpoint loads", async () => {
    const initial = endpoint();
    const { result, rerender } = renderHook(
      ({ value, slug }) => useEndpointDraft(value, slug),
      {
        initialProps: {
          value: initial as Doc<"apiEndpoints"> | undefined,
          slug: initial.slug,
        },
      },
    );

    await waitFor(() => expect(result.current.draftEndpointId).toBe(initial._id));

    rerender({ value: undefined, slug: "plain-document" });

    await waitFor(() => {
      expect(result.current.draft).toBeNull();
      expect(result.current.draftEndpointId).toBeNull();
    });
  });
});

describe("document types", () => {
  it("always opens API endpoints in the API editor", () => {
    const draft = createEndpointDraft(
      endpoint({
        endpointType: "endpoint",
        content: JSON.stringify({ type: "doc", content: [] }),
      }),
    );

    expect(draft.editorType).toBe("api");
  });

  it("switches between a page and an API endpoint without a modal", () => {
    const apiDraft = draftForEndpointType(
      createEndpointDraft(endpoint()),
      "doc",
    );

    expect(apiDraft).toMatchObject({
      endpointType: "doc",
      editorType: "notion",
    });
    expect(JSON.parse(apiDraft.content)).toEqual({
      type: "doc",
      content: [],
    });

    expect(draftForEndpointType(apiDraft, "endpoint")).toMatchObject({
      endpointType: "endpoint",
      editorType: "api",
    });
  });

  it("clears custom icons when a documentation page becomes an API endpoint", () => {
    const docDraft = draftForEndpointType(
      createEndpointDraft(
        endpoint({
          endpointType: "doc",
          content: JSON.stringify({ type: "doc", content: [] }),
          iconName: "rocket",
        }),
      ),
      "endpoint",
    );

    expect(docDraft).toMatchObject({
      endpointType: "endpoint",
      editorType: "api",
      iconName: undefined,
    });
  });
});

describe("project documentation navigation", () => {
  it("exposes active project documentation areas", () => {
    expect(PROJECT_DOCUMENTATION_AREAS).toEqual([
      { id: "guides", label: "Guides", status: "active" },
      { id: "api-reference", label: "API Reference", status: "active" },
      { id: "navigation", label: "Navigation", status: "active" },
      { id: "metrics", label: "Metrics", status: "active" },
      { id: "ai", label: "AI", status: "active" },
      { id: "version-settings", label: "Version Settings", status: "active" },
      { id: "settings", label: "Settings", status: "active" },
    ]);
  });

  it("opens the first available item for each documentation area", () => {
    expect(
      getFirstEndpointSlug([
        {
          endpoints: [],
        },
        {
          endpoints: [{ slug: "create-user" }],
        },
      ] as never),
    ).toBe("create-user");

    expect(
      getFirstGuidePageSlug([
        {
          pages: [],
        },
        {
          pages: [{ slug: "getting-started" }],
        },
      ] as never),
    ).toBe("getting-started");
  });

  it("does not select a default when an area has no pages", () => {
    expect(getFirstEndpointSlug([])).toBeUndefined();
    expect(getFirstGuidePageSlug([])).toBeUndefined();
  });
});

describe("RawRequestBodyImportModal", () => {
  it("imports valid nested JSON as structured request body fields", () => {
    const onImport = vi.fn();

    render(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled={false}
        onClose={() => undefined}
        onImport={onImport}
      />,
    );

    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: {
        value: JSON.stringify({
          email: "ada@example.com",
          profile: { first_name: "Ada" },
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import fields" }));

    expect(onImport).toHaveBeenCalledWith([
      {
        name: "email",
        dataType: "string",
        required: false,
        description: "",
      },
      {
        name: "profile",
        dataType: "object",
        required: false,
        description: "",
        fields: [
          {
            name: "first_name",
            dataType: "string",
            required: false,
            description: "",
          },
        ],
      },
    ]);
  });

  it("preserves invalid JSON and does not import", () => {
    const onImport = vi.fn();

    render(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled={false}
        onClose={() => undefined}
        onImport={onImport}
      />,
    );

    const textarea = screen.getByLabelText("JSON body");
    fireEvent.change(textarea, { target: { value: '{"email":' } });
    fireEvent.click(screen.getByRole("button", { name: "Import fields" }));

    expect(screen.getByRole("alert").textContent).toContain("Enter valid JSON:");
    expect((textarea as HTMLTextAreaElement).value).toBe('{"email":');
    expect(onImport).not.toHaveBeenCalled();
  });

  it("rejects a top-level array", () => {
    render(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled={false}
        onClose={() => undefined}
        onImport={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: "[]" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import fields" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "The request body must be a top-level JSON object.",
    );
  });

  it("warns before replacing existing fields", () => {
    render(
      <RawRequestBodyImportModal
        open
        hasExistingFields
        disabled={false}
        onClose={() => undefined}
        onImport={() => undefined}
      />,
    );

    expect(screen.getByText("Existing fields will be replaced")).toBeTruthy();
  });

  it("clears local input when cancelled and reopened", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled={false}
        onClose={onClose}
        onImport={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: '{"email":"ada@example.com"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <RawRequestBodyImportModal
        open={false}
        hasExistingFields={false}
        disabled={false}
        onClose={onClose}
        onImport={() => undefined}
      />,
    );
    rerender(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled={false}
        onClose={onClose}
        onImport={() => undefined}
      />,
    );

    expect(
      (screen.getByLabelText("JSON body") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("prevents importing when disabled", () => {
    const onImport = vi.fn();

    render(
      <RawRequestBodyImportModal
        open
        hasExistingFields={false}
        disabled
        onClose={() => undefined}
        onImport={onImport}
      />,
    );

    expect(
      (screen.getByLabelText("JSON body") as HTMLTextAreaElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Import fields",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe("endpoint ordering", () => {
  it("moves an endpoint to a new position without mutating the source list", () => {
    const endpoints = ["authentication", "create-user", "get-user"];

    expect(reorderEndpointItems(endpoints, 2, 0)).toEqual([
      "get-user",
      "authentication",
      "create-user",
    ]);
    expect(endpoints).toEqual([
      "authentication",
      "create-user",
      "get-user",
    ]);
  });

  it("leaves the order unchanged for an invalid target", () => {
    expect(reorderEndpointItems(["one", "two"], 0, 4)).toEqual([
      "one",
      "two",
    ]);
  });
});

describe("section ordering", () => {
  it("moves a complete section to a new position", () => {
    const sections = ["authentication", "users", "billing"];

    expect(reorderSectionItems(sections, 0, 2)).toEqual([
      "users",
      "billing",
      "authentication",
    ]);
    expect(sections).toEqual(["authentication", "users", "billing"]);
  });
});

describe("endpoint editor field controls", () => {
  it("preserves imported custom data types in the dropdown options", () => {
    expect(
      optionsWithCurrentValue(
        [
          { value: "string", label: "String" },
          { value: "array", label: "Array" },
        ],
        "array<string>",
      ),
    ).toEqual([
      { value: "array<string>", label: "array<string>" },
      { value: "string", label: "String" },
      { value: "array", label: "Array" },
    ]);
  });

  it("preserves uncommon imported response status codes", () => {
    expect(statusOptionsWithCurrentValue(418)[0]).toEqual({
      value: 418,
      label: "418",
    });
  });

  it("renders domain dropdowns and reports text changes", () => {
    let changedName = "";

    render(
      <EndpointFieldEditor
        idPrefix="test-parameter"
        field={{
          name: "user_id",
          dataType: "string",
          required: true,
          description: "User identifier",
        }}
        location="path"
        disabled={false}
        onChange={(field) => {
          changedName = field.name;
        }}
        onLocationChange={() => undefined}
        onRemove={() => undefined}
      />,
    );

    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "account_id" },
    });
    expect(changedName).toBe("account_id");
  });

  it("adds nested fields to object request-body fields", () => {
    let nestedFieldCount = 0;

    render(
      <EndpointFieldEditor
        idPrefix="object-field"
        field={{
          name: "customer",
          dataType: "object",
          required: true,
          description: "Customer details",
          fields: [],
        }}
        supportsNested
        disabled={false}
        onChange={(field) => {
          nestedFieldCount = field.fields?.length ?? 0;
        }}
        onRemove={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Nested Field" }),
    );
    expect(nestedFieldCount).toBe(1);
  });

  it("constructs nested request values from object inputs", () => {
    const values = setNestedRequestValue(
      {},
      ["customer", "address", "city"],
      "Lagos",
    );

    expect(values).toEqual({
      customer: {
        address: {
          city: "Lagos",
        },
      },
    });
  });
});
