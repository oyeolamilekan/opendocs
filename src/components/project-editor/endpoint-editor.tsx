import { useState, type FormEvent, type ReactNode } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  extractPathPlaceholders,
  joinEndpointUrl,
  normalizeEndpointPath,
  syncPathParameters,
} from "../../lib/endpoint-path";
import {
  inferRequestBodyFields,
  type InferredRequestBodyField,
} from "../../lib/request-body-inference";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Field, FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { useToast } from "../ui/toast";
import { DocumentTypeMenu, NotionPageEditor } from "../notion-page-editor";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  Globe2,
  Import as ImportIcon,
  KeyRound,
  ListTree,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import {
  draftForEndpointType,
  optionsWithCurrentValue,
  statusOptionsWithCurrentValue,
} from "./helpers";
import type { EndpointBody, EndpointDraft, Navigation } from "./types";

const DATA_TYPE_OPTIONS = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
] as const;

const PARAMETER_LOCATION_OPTIONS = [
  { value: "path", label: "Path" },
  { value: "query", label: "Query" },
  { value: "header", label: "Header" },
  { value: "cookie", label: "Cookie" },
] as const;

export function EndpointEditor({
  projectId,
  baseUrl,
  draft,
  navigation,
  canManage,
  onChange,
  onDelete,
}: {
  projectId: Id<"apiProjects">;
  baseUrl: string;
  draft: EndpointDraft;
  navigation: Navigation;
  canManage: boolean;
  onChange: (draft: EndpointDraft) => void;
  onDelete: () => void;
}) {
  const disabled = !canManage;
  const toast = useToast();
  const [isRawBodyImportOpen, setIsRawBodyImportOpen] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const fullUrl = joinEndpointUrl(baseUrl, draft.body.path);
  const pathPlaceholders = extractPathPlaceholders(draft.body.path);
  const unmatchedPathParameters = draft.body.parameters.filter(
    (parameter) =>
      parameter.location === "path" &&
      !pathPlaceholders.includes(parameter.name),
  );
  const updateBody = (patch: Partial<EndpointBody>) =>
    onChange({ ...draft, body: { ...draft.body, ...patch } });
  const updatePath = (path: string) =>
    updateBody({
      path,
      parameters: syncPathParameters(
        draft.body.path,
        path,
        draft.body.parameters,
      ),
    });

  async function copyFullUrl() {
    await navigator.clipboard.writeText(fullUrl);
    setUrlCopied(true);
    window.setTimeout(() => setUrlCopied(false), 1500);
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
      {!canManage ? (
        <Alert>
          <Lock />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            Your member role can review this project but cannot change it.
          </AlertDescription>
        </Alert>
      ) : null}

      {draft.editorType === "notion" ? (
        <NotionPageEditor
          projectId={projectId}
          draft={draft}
          canManage={canManage}
          onChange={onChange}
          onTypeChange={(endpointType) =>
            onChange(draftForEndpointType(draft, endpointType))
          }
        />
      ) : (
        <Card>
          <Tabs defaultValue="overview">
            <CardHeader className="border-b">
              <TabsList
                variant="line"
                className="h-12 max-w-full justify-start gap-2 overflow-x-auto p-0"
              >
                <TabsTrigger
                  value="overview"
                  className="h-11 flex-none gap-2 px-3"
                >
                  <Globe2 />
                  Overview
                </TabsTrigger>
                {draft.endpointType === "endpoint" ? (
                  <>
                    <TabsTrigger
                      value="request"
                      className="h-11 flex-none gap-2 px-3"
                    >
                      <KeyRound />
                      Request
                    </TabsTrigger>
                    <TabsTrigger
                      value="body"
                      className="h-11 flex-none gap-2 px-3"
                    >
                      <Braces />
                      Body
                    </TabsTrigger>
                    <TabsTrigger
                      value="responses"
                      className="h-11 flex-none gap-2 px-3"
                    >
                      <FileCode2 />
                      Responses
                    </TabsTrigger>
                  </>
                ) : null}
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="overview">
                <FieldGroup>
                  <DocumentTypeMenu
                    value={draft.endpointType}
                    disabled={disabled}
                    onValueChange={(endpointType) =>
                      onChange(draftForEndpointType(draft, endpointType))
                    }
                  />
                  <div className="grid gap-5 lg:grid-cols-[1fr_14rem]">
                    <Field label="Endpoint title" htmlFor="editor-title">
                      <Input
                        id="editor-title"
                        value={draft.title}
                        onChange={(event) =>
                          onChange({ ...draft, title: event.target.value })
                        }
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="Section" htmlFor="editor-section">
                      <Select
                        value={draft.sectionId}
                        onValueChange={(value) =>
                          onChange({
                            ...draft,
                            sectionId: value as Id<"apiSections">,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger id="editor-section" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {navigation.map((section) => (
                              <SelectItem key={section._id} value={section._id}>
                                {section.title}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {draft.endpointType === "endpoint" ? (
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
                      <div className="grid gap-3 lg:grid-cols-[8rem_minmax(0,1fr)]">
                        <Field label="Method" htmlFor="editor-method">
                          <Select
                            value={draft.body.method}
                            onValueChange={(value) =>
                              updateBody({
                                method: value as EndpointBody["method"],
                              })
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger
                              id="editor-method"
                              className="w-full font-semibold"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {[
                                  "GET",
                                  "POST",
                                  "PUT",
                                  "PATCH",
                                  "DELETE",
                                  "OPTIONS",
                                  "HEAD",
                                ].map((method) => (
                                  <SelectItem key={method} value={method}>
                                    {method}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field
                          label="Endpoint path"
                          htmlFor="editor-path"
                          hint="Use {name} for path parameters"
                        >
                          <div className="flex min-w-0 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/30">
                            <span className="flex max-w-[55%] shrink-0 items-center border-r bg-muted/50 px-3 font-mono text-sm text-muted-foreground">
                              <span className="truncate">
                                {baseUrl.replace(/\/+$/, "")}
                              </span>
                            </span>
                            <Input
                              id="editor-path"
                              className="min-w-28 rounded-none border-0 font-mono focus-visible:ring-0"
                              value={draft.body.path}
                              onChange={(event) =>
                                updatePath(event.target.value)
                              }
                              onBlur={() =>
                                updatePath(
                                  normalizeEndpointPath(draft.body.path),
                                )
                              }
                              disabled={disabled}
                              placeholder="/users/{id}"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-2">
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Full URL
                        </span>
                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                          {fullUrl}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void copyFullUrl()}
                          aria-label={
                            urlCopied ? "URL copied" : "Copy full URL"
                          }
                        >
                          {urlCopied ? <Check /> : <Copy />}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <Field label="Description" htmlFor="editor-description">
                    <Textarea
                      id="editor-description"
                      value={draft.body.description}
                      onChange={(event) =>
                        updateBody({ description: event.target.value })
                      }
                      disabled={disabled}
                      className="min-h-32"
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>

            {draft.endpointType === "endpoint" ? (
              <>
                <TabsContent value="request" className="flex flex-col gap-8">
                  <AuthenticationEditor
                    authHeader={draft.body.authHeader}
                    disabled={disabled}
                    onChange={(authHeader) => updateBody({ authHeader })}
                  />
                  <Separator />
                  <EditorTabSection
                    title="Parameters"
                    description="Path, query, header, and cookie parameters."
                    canManage={canManage}
                    onAdd={() =>
                      updateBody({
                        parameters: [
                          ...draft.body.parameters,
                          {
                            name: "",
                            location: "query",
                            required: false,
                            description: "",
                            dataType: "string",
                          },
                        ],
                      })
                    }
                  >
                    {unmatchedPathParameters.length ? (
                      <Alert>
                        <ListTree />
                        <AlertTitle>Unmatched path parameters</AlertTitle>
                        <AlertDescription>
                          {unmatchedPathParameters
                            .map((parameter) => `{${parameter.name}}`)
                            .join(", ")}{" "}
                          no longer appear in the endpoint path. Remove them or
                          add their placeholders back to the path.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {draft.body.parameters.map((parameter, index) => (
                      <EndpointFieldEditor
                        key={index}
                        idPrefix={`parameter-${index}`}
                        field={parameter}
                        location={parameter.location}
                        disabled={disabled}
                        onChange={(field) => {
                          const parameters = [...draft.body.parameters];
                          parameters[index] = {
                            ...parameter,
                            ...field,
                          };
                          updateBody({ parameters });
                        }}
                        onLocationChange={(location) => {
                          const parameters = [...draft.body.parameters];
                          parameters[index] = { ...parameter, location };
                          updateBody({ parameters });
                        }}
                        onRemove={() =>
                          updateBody({
                            parameters: draft.body.parameters.filter(
                              (_, candidate) => candidate !== index,
                            ),
                          })
                        }
                      />
                    ))}
                  </EditorTabSection>
                </TabsContent>

                <TabsContent value="body">
                  <EditorTabSection
                    title="Request Body"
                    description="Define fields for the request payload."
                    canManage={canManage}
                    onAdd={() =>
                      updateBody({
                        requestBody: [
                          ...draft.body.requestBody,
                          {
                            name: "",
                            required: false,
                            description: "",
                            dataType: "string",
                          },
                        ],
                      })
                    }
                  >
                    {draft.body.requestBody.length === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsRawBodyImportOpen(true)}
                      >
                        <ImportIcon className="size-4" />
                        Import from JSON
                      </Button>
                    ) : null}
                    {draft.body.requestBody.map((field, index) => (
                      <EndpointFieldEditor
                        key={index}
                        idPrefix={`request-body-${index}`}
                        field={field}
                        location="body"
                        disabled={disabled}
                        onChange={(nextField) => {
                          const requestBody = [...draft.body.requestBody];
                          requestBody[index] = { ...field, ...nextField };
                          updateBody({ requestBody });
                        }}
                        onLocationChange={() => {}}
                        onRemove={() =>
                          updateBody({
                            requestBody: draft.body.requestBody.filter(
                              (_, candidate) => candidate !== index,
                            ),
                          })
                        }
                      />
                    ))}
                  </EditorTabSection>
                </TabsContent>

                <TabsContent value="responses">
                  <EditorTabSection
                    title="Sample Responses"
                    description="Document successful and error response payloads."
                    canManage={canManage}
                    onAdd={() =>
                      updateBody({
                        sampleResponses: [
                          ...draft.body.sampleResponses,
                          { statusCode: 200, description: "", body: "{}" },
                        ],
                      })
                    }
                  >
                    {draft.body.sampleResponses.map((response, index) => (
                      <SampleResponseEditor
                        key={index}
                        idPrefix={`response-${index}`}
                        response={response}
                        disabled={disabled}
                        onChange={(nextResponse) => {
                          const sampleResponses = [
                            ...draft.body.sampleResponses,
                          ];
                          sampleResponses[index] = nextResponse;
                          updateBody({ sampleResponses });
                        }}
                        onRemove={() =>
                          updateBody({
                            sampleResponses:
                              draft.body.sampleResponses.filter(
                                (_, candidate) => candidate !== index,
                              ),
                          })
                        }
                      />
                    ))}
                  </EditorTabSection>
                </TabsContent>
              </>
            ) : null}
            </CardContent>
          </Tabs>
        </Card>
      )}

      <RawRequestBodyImportModal
        open={isRawBodyImportOpen}
        hasExistingFields={draft.body.requestBody.length > 0}
        disabled={disabled}
        onClose={() => setIsRawBodyImportOpen(false)}
        onImport={(requestBody) => {
          updateBody({ requestBody });
          setIsRawBodyImportOpen(false);
          toast.success("Request body fields imported");
        }}
      />

      {canManage ? (
        <div className="flex justify-end">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete Endpoint
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EditorTabSection({
  title,
  description,
  canManage,
  onAdd,
  actions,
  children,
}: {
  title: string;
  description: string;
  canManage: boolean;
  onAdd: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              onClick={onAdd}
            >
              <Plus data-icon="inline-start" /> Add
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function RawRequestBodyImportModal({
  open,
  hasExistingFields,
  disabled,
  onClose,
  onImport,
}: {
  open: boolean;
  hasExistingFields: boolean;
  disabled: boolean;
  onClose: () => void;
  onImport: (fields: InferredRequestBodyField[]) => void;
}) {
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState("");

  function closeModal() {
    setRawJson("");
    setError("");
    onClose();
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const result = inferRequestBodyFields(rawJson);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onImport(result.fields);
    setRawJson("");
    setError("");
  }

  return (
    <Modal
      open={open}
      title="Import request body from JSON"
      description="Paste an example JSON object to generate editable request body fields."
      onClose={closeModal}
    >
      <form onSubmit={submitImport}>
        <FieldGroup>
          {hasExistingFields ? (
            <Alert>
              <AlertTitle>Existing fields will be replaced</AlertTitle>
              <AlertDescription>
                Importing this JSON replaces the current request body fields
                after you confirm the import.
              </AlertDescription>
            </Alert>
          ) : null}

          <Field label="JSON body" htmlFor="raw-request-body-json">
            <Textarea
              id="raw-request-body-json"
              value={rawJson}
              onChange={(event) => {
                setRawJson(event.target.value);
                if (error) setError("");
              }}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              className="min-h-64 resize-y font-mono"
              placeholder={`{
  "email": "ada@example.com",
  "profile": {
    "first_name": "Ada"
  }
}`}
              autoFocus
            />
          </Field>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to import JSON</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={disabled || rawJson.trim().length === 0}
            >
              <ImportIcon data-icon="inline-start" />
              Import fields
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Modal>
  );
}

type EditableEndpointField = {
  name: string;
  dataType: string;
  required: boolean;
  description: string;
  fields?: EditableEndpointField[];
};

export function EndpointFieldEditor({
  idPrefix,
  field,
  location,
  supportsNested = false,
  depth = 0,
  disabled,
  onChange,
  onLocationChange,
  onRemove,
}: {
  idPrefix: string;
  field: EditableEndpointField;
  location?: string;
  supportsNested?: boolean;
  depth?: number;
  disabled: boolean;
  onChange: (field: EditableEndpointField) => void;
  onLocationChange?: (location: string) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(
    field.dataType === "object" || Boolean(field.fields?.length),
  );
  const dataTypeOptions = optionsWithCurrentValue(
    DATA_TYPE_OPTIONS,
    field.dataType,
  );
  const locationOptions = optionsWithCurrentValue(
    PARAMETER_LOCATION_OPTIONS,
    location ?? "",
  );
  const isStructuredField =
    supportsNested &&
    (field.dataType === "object" || Boolean(field.fields?.length));
  const canAddNestedField = isStructuredField && depth < 5;

  function changeDataType(dataType: string) {
    if (supportsNested && dataType === "object") {
      setExpanded(true);
      onChange({ ...field, dataType, fields: field.fields ?? [] });
      return;
    }
    const { fields: _fields, ...scalarField } = field;
    onChange({ ...scalarField, dataType });
  }

  function updateNestedField(
    nestedIndex: number,
    nextField: EditableEndpointField,
  ) {
    const fields = [...(field.fields ?? [])];
    fields[nestedIndex] = nextField;
    onChange({ ...field, fields });
  }

  return (
    <div className={depth ? "border-l pl-4" : "rounded-lg border bg-muted/30 p-4"}>
      <div
        className={
          onLocationChange
            ? "grid gap-3 lg:grid-cols-2 xl:grid-cols-4"
            : "grid gap-3 lg:grid-cols-3"
        }
      >
        <div className="flex items-end gap-1">
          {isStructuredField ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((current) => !current)}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${
                field.name || "object"
              }`}
            >
              {expanded ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : null}
          <Field label="Name" htmlFor={`${idPrefix}-name`} className="flex-1">
            <Input
              id={`${idPrefix}-name`}
              value={field.name}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...field, name: event.target.value })
              }
              placeholder="Field name"
            />
          </Field>
        </div>

        <Field label="Data type" htmlFor={`${idPrefix}-data-type`}>
          <Select
            value={field.dataType}
            disabled={disabled}
            onValueChange={changeDataType}
          >
            <SelectTrigger id={`${idPrefix}-data-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {dataTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {onLocationChange ? (
          <Field label="Location" htmlFor={`${idPrefix}-location`}>
            <Select
              value={location}
              disabled={disabled}
              onValueChange={onLocationChange}
            >
              <SelectTrigger id={`${idPrefix}-location`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {locationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Requirement" htmlFor={`${idPrefix}-requirement`}>
          <Select
            value={field.required ? "required" : "optional"}
            disabled={disabled}
            onValueChange={(requirement) =>
              onChange({
                ...field,
                required: requirement === "required",
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-requirement`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Description"
          htmlFor={`${idPrefix}-description`}
          className="flex-1"
        >
          <Textarea
            id={`${idPrefix}-description`}
            value={field.description}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...field, description: event.target.value })
            }
            placeholder="Describe this field"
            className="min-h-20"
          />
        </Field>
        {!disabled ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${field.name || "field"}`}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>

      {isStructuredField && expanded ? (
        <div className="mt-4 flex flex-col gap-3">
          {field.fields?.map((nestedField, nestedIndex) => (
            <EndpointFieldEditor
              key={`${idPrefix}-${nestedIndex}`}
              idPrefix={`${idPrefix}-field-${nestedIndex}`}
              field={nestedField}
              supportsNested
              depth={depth + 1}
              disabled={disabled}
              onChange={(nextField) =>
                updateNestedField(nestedIndex, nextField)
              }
              onRemove={() =>
                onChange({
                  ...field,
                  fields: (field.fields ?? []).filter(
                    (_, candidate) => candidate !== nestedIndex,
                  ),
                })
              }
            />
          ))}
          {canAddNestedField && !disabled ? (
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() =>
                onChange({
                  ...field,
                  fields: [
                    ...(field.fields ?? []),
                    {
                      name: "",
                      dataType: "string",
                      required: false,
                      description: "",
                    },
                  ],
                })
              }
            >
              <Plus data-icon="inline-start" />
              Add Nested Field
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AuthenticationEditor({
  authHeader,
  disabled,
  onChange,
}: {
  authHeader: EndpointBody["authHeader"];
  disabled: boolean;
  onChange: (authHeader: EndpointBody["authHeader"]) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="font-semibold">Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the credentials required for this endpoint.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Type" htmlFor="auth-type">
          <Select
            value={authHeader.type}
            disabled={disabled}
            onValueChange={(value) => {
              const type = value as EndpointBody["authHeader"]["type"];
              const defaultKey =
                type === "apiKey"
                  ? authHeader.key && authHeader.key !== "Authorization"
                    ? authHeader.key
                    : "X-API-Key"
                  : type === "none"
                    ? ""
                    : "Authorization";
              onChange({ ...authHeader, type, key: defaultKey });
            }}
          >
            <SelectTrigger id="auth-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No authentication</SelectItem>
                <SelectItem value="bearer">Bearer token</SelectItem>
                <SelectItem value="apiKey">API key</SelectItem>
                <SelectItem value="basic">Basic auth</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {authHeader.type !== "none" ? (
          <Field label="Header key" htmlFor="auth-key">
            <Input
              id="auth-key"
              value={authHeader.key}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...authHeader, key: event.target.value })
              }
              placeholder={
                authHeader.type === "apiKey"
                  ? "X-API-Key"
                  : "Authorization"
              }
            />
          </Field>
        ) : null}
      </div>

      {authHeader.type !== "none" ? (
        <Field label="Example value" htmlFor="auth-value">
          <Input
            id="auth-value"
            value={authHeader.value}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...authHeader, value: event.target.value })
            }
            placeholder={
              authHeader.type === "basic"
                ? "username:password"
                : authHeader.type === "bearer"
                  ? "Token"
                  : "API key"
            }
          />
        </Field>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          This endpoint does not require credentials.
        </p>
      )}
    </section>
  );
}

function SampleResponseEditor({
  idPrefix,
  response,
  disabled,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  response: EndpointBody["sampleResponses"][number];
  disabled: boolean;
  onChange: (response: EndpointBody["sampleResponses"][number]) => void;
  onRemove: () => void;
}) {
  const statusOptions = statusOptionsWithCurrentValue(response.statusCode);

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-3 lg:grid-cols-[14rem_1fr_auto]">
        <Field label="Status" htmlFor={`${idPrefix}-status`}>
          <Select
            value={String(response.statusCode)}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({ ...response, statusCode: Number(value) })
            }
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={String(option.value)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description" htmlFor={`${idPrefix}-description`}>
          <Input
            id={`${idPrefix}-description`}
            value={response.description}
            disabled={disabled}
            placeholder="Response description"
            onChange={(event) =>
              onChange({ ...response, description: event.target.value })
            }
          />
        </Field>
        {!disabled ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove response ${response.statusCode}`}
            className="self-end"
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      <Field label="Response body" htmlFor={`${idPrefix}-body`} className="mt-3">
        <Textarea
          id={`${idPrefix}-body`}
          value={response.body}
          disabled={disabled}
          className="min-h-32 font-mono"
          onChange={(event) =>
            onChange({ ...response, body: event.target.value })
          }
        />
      </Field>
    </div>
  );
}
