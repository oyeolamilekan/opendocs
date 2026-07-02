import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Save, Settings, Sparkles, Type, Upload } from "lucide-react";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  DEFAULT_DOCUMENTATION_FONT,
  DEFAULT_DOCUMENTATION_STYLE,
  DEFAULT_DOCUMENTATION_THEME_COLOR,
  DOCUMENTATION_FONTS,
  DOCUMENTATION_STYLES,
  DOCUMENTATION_THEMES,
  getDocumentationFont,
  getDocumentationTheme,
  isValidBrandColor,
  type DocumentationFont,
} from "../lib/documentation-theme";
import { getErrorMessage } from "../lib/errors";
import { cn } from "../lib/utils";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import { ProjectDashboardLoadingPage } from "./project-dashboard-loading-page";
import { ProjectParentNavigation } from "./project-editor";
import { ThemeToggle } from "./theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Field, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { EmptyState } from "./ui/status";
import { useToast } from "./ui/toast";

type BrandAsset = "logo" | "darkLogo" | "favicon";

const BRAND_ASSET_LABELS: Record<BrandAsset, string> = {
  logo: "Light logo",
  darkLogo: "Dark-mode logo",
  favicon: "Favicon",
};

const ALLOWED_BRAND_ASSET_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon",
]);

const MAX_BRAND_ASSET_SIZE = 10 * 1024 * 1024;

type BrandAssetState = Record<
  BrandAsset,
  {
    url: string;
    fileName: string;
  }
>;

type DocumentationThemeValue = (typeof DOCUMENTATION_THEMES)[number]["value"];

function getValidDocumentationThemeValue(value: string | undefined) {
  return DOCUMENTATION_THEMES.some((theme) => theme.value === value)
    ? (value as DocumentationThemeValue)
    : DEFAULT_DOCUMENTATION_THEME_COLOR;
}

export function ProjectSettingsPage({
  organization,
  membership,
  projectSlug,
}: {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
  projectSlug: string;
}) {
  const settings = useQuery(api.projects.getSettingsBySlug, {
    organizationId: organization._id,
    slug: projectSlug,
  });
  const updateProject = useMutation(api.projects.update);
  const generateImageUploadUrl = useMutation(api.files.generateImageUploadUrl);
  const completeBrandAssetUpload = useMutation(
    api.files.completeBrandAssetUpload,
  );
  const navigate = useNavigate();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<BrandAsset | null>(null);
  const [brandColorValue, setBrandColorValue] = useState("");
  const [themeColorValue, setThemeColorValue] =
    useState<DocumentationThemeValue>(DEFAULT_DOCUMENTATION_THEME_COLOR);
  const [assets, setAssets] = useState<BrandAssetState>({
    logo: { url: "", fileName: "" },
    darkLogo: { url: "", fileName: "" },
    favicon: { url: "", fileName: "" },
  });
  const canManage = membership.role === "owner" || membership.role === "admin";
  const project = settings?.project;
  const versions = settings?.versions ?? [];

  useEffect(() => {
    if (!settings) return;
    setBrandColorValue(settings.project.brandColor ?? "");
    setThemeColorValue(
      getValidDocumentationThemeValue(settings.project.themeColor),
    );
    setAssets({
      logo: {
        url: settings.logoUrl ?? "",
        fileName: settings.logoFileName ?? "",
      },
      darkLogo: {
        url: settings.darkLogoUrl ?? "",
        fileName: settings.darkLogoFileName ?? "",
      },
      favicon: {
        url: settings.faviconUrl ?? "",
        fileName: settings.faviconFileName ?? "",
      },
    });
  }, [settings]);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !canManage) return;

    const form = new FormData(event.currentTarget);
    const brandColor = brandColorValue.trim();
    if (brandColor && !isValidBrandColor(brandColor)) {
      toast.error("Brand color must be a 6-digit hex color");
      return;
    }

    setIsSaving(true);
    try {
      const themeColor = getValidDocumentationThemeValue(themeColorValue);
      const updated = await updateProject({
        projectId: project._id,
        title: String(form.get("title") ?? ""),
        themeColor,
        brandColor,
        documentationStyle: String(form.get("documentationStyle")) as
          | "default"
          | "compact"
          | "editorial",
        documentationFont: String(
          form.get("documentationFont"),
        ) as DocumentationFont,
      });
      toast.success("Documentation settings saved");
      if (updated && updated.slug !== projectSlug) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/settings",
          params: {
            organizationSlug: organization.slug,
            projectSlug: updated.slug,
          },
          replace: true,
        });
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to save documentation settings"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadBrandAsset(asset: BrandAsset, file: File | undefined) {
    if (!project || !file || !canManage) return;

    if (!ALLOWED_BRAND_ASSET_TYPES.has(file.type)) {
      toast.error("Brand assets must be PNG, JPEG, GIF, WebP, SVG, or ICO");
      return;
    }
    if (file.size > MAX_BRAND_ASSET_SIZE) {
      toast.error("Brand assets must be 10 MB or smaller");
      return;
    }

    setUploadingAsset(asset);
    try {
      const uploadUrl = await generateImageUploadUrl({
        projectId: project._id,
      });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Asset upload failed");
      const payload = (await response.json()) as { storageId: string };
      const uploaded = await completeBrandAssetUpload({
        projectId: project._id,
        storageId: payload.storageId as Id<"_storage">,
        fileName: file.name,
      });
      await updateProject({
        projectId: project._id,
        ...(asset === "logo" ? { logoStorageId: uploaded.storageId } : {}),
        ...(asset === "darkLogo"
          ? { darkLogoStorageId: uploaded.storageId }
          : {}),
        ...(asset === "favicon"
          ? { faviconStorageId: uploaded.storageId }
          : {}),
      });
      setAssets((current) => ({
        ...current,
        [asset]: { url: uploaded.url, fileName: file.name },
      }));
      toast.success(`${BRAND_ASSET_LABELS[asset]} uploaded`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to upload brand asset"));
    } finally {
      setUploadingAsset(null);
    }
  }

  async function removeBrandAsset(asset: BrandAsset) {
    if (!project || !canManage) return;

    setUploadingAsset(asset);
    try {
      await updateProject({
        projectId: project._id,
        ...(asset === "logo" ? { logoStorageId: null } : {}),
        ...(asset === "darkLogo" ? { darkLogoStorageId: null } : {}),
        ...(asset === "favicon" ? { faviconStorageId: null } : {}),
      });
      setAssets((current) => ({
        ...current,
        [asset]: { url: "", fileName: "" },
      }));
      toast.success(`${BRAND_ASSET_LABELS[asset]} removed`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to remove brand asset"));
    } finally {
      setUploadingAsset(null);
    }
  }

  if (settings === undefined) {
    return (
      <ProjectDashboardLoadingPage
        kind="settings"
        label="Loading settings page"
      />
    );
  }

  if (settings === null || !project) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Project Not Found"
          description="This project may have been renamed or deleted. Return to the project list to continue."
          action={
            <Button asChild>
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug: organization.slug }}
                {...smoothDashboardLinkProps}
              >
                Return to projects
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const theme = getDocumentationTheme(themeColorValue);
  const brandColor = brandColorValue;
  const previewColor = brandColor || theme.primary;
  const colorPickerValue = isValidBrandColor(brandColor)
    ? brandColor
    : theme.primary.startsWith("#")
      ? theme.primary
      : "#018ef5";

  return (
    <div className="project-editor-shell flex min-h-svh w-full overflow-x-hidden bg-sidebar text-foreground">
      <ProjectParentNavigation
        organizationSlug={organization.slug}
        projectSlug={project.slug}
        projectId={project._id}
        projectTitle={project.title}
        versions={versions ?? []}
        canManage={canManage}
        activeArea="settings"
      />
      <SidebarProvider className="min-w-0 flex-1 overflow-x-hidden">
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
            <SidebarTrigger className="lg:hidden" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects"
                      params={{ organizationSlug: organization.slug }}
                      {...smoothDashboardLinkProps}
                    >
                      {organization.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:list-item" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects/$projectSlug"
                      params={{
                        organizationSlug: organization.slug,
                        projectSlug: project.slug,
                      }}
                      {...smoothDashboardLinkProps}
                    >
                      {project.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ThemeToggle className="ml-auto" />
          </header>

          <main className="dashboard-route-panel app-container py-10">
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className="w-fit">
                <Settings />
                Project settings
              </Badge>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                Documentation branding
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Control the public docs title, brand color, style, typography,
                logos, and favicon for this project.
              </p>
            </div>

            {!canManage ? (
              <Alert className="mt-8">
                <Settings />
                <AlertTitle>View-only access</AlertTitle>
                <AlertDescription>
                  Only owners and admins can change documentation branding.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <form onSubmit={submitSettings}>
                <Card className="overflow-hidden border-border/80 bg-card/95">
                  <CardHeader>
                    <CardTitle>Brand kit</CardTitle>
                    <CardDescription>
                      These settings are applied to the published documentation
                      page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field
                        label="Docs title"
                        htmlFor="project-settings-title"
                      >
                        <Input
                          id="project-settings-title"
                          name="title"
                          defaultValue={project.title}
                          disabled={!canManage}
                          required
                        />
                      </Field>
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field
                          label="Theme preset"
                          htmlFor="project-settings-theme"
                        >
                          <Select
                            name="themeColor"
                            value={themeColorValue}
                            onValueChange={(value) =>
                              setThemeColorValue(
                                getValidDocumentationThemeValue(value),
                              )
                            }
                            disabled={!canManage}
                          >
                            <SelectTrigger
                              id="project-settings-theme"
                              className="h-11 w-full justify-start gap-3 px-3"
                            >
                              <span
                                className="size-6 rounded-md"
                                style={{ backgroundColor: theme.primary }}
                              />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {DOCUMENTATION_THEMES.map((themeOption) => (
                                  <SelectItem
                                    key={themeOption.value}
                                    value={themeOption.value}
                                  >
                                    <span
                                      className="size-4 rounded-md"
                                      style={{
                                        backgroundColor: themeOption.primary,
                                      }}
                                    />
                                    {themeOption.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field
                          label="Custom brand color"
                          htmlFor="project-settings-brand-color"
                          hint="Optional hex"
                        >
                          <div className="flex h-11 items-center gap-3 rounded-lg border bg-background px-3">
                            <input
                              type="color"
                              aria-label="Pick custom brand color"
                              value={colorPickerValue}
                              disabled={!canManage}
                              onChange={(event) =>
                                setBrandColorValue(
                                  event.currentTarget.value.toUpperCase(),
                                )
                              }
                              className="size-6 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                            />
                            <Input
                              id="project-settings-brand-color"
                              name="brandColor"
                              value={brandColor}
                              onChange={(event) =>
                                setBrandColorValue(event.currentTarget.value)
                              }
                              placeholder="#018EF5"
                              pattern="#[0-9a-fA-F]{6}"
                              disabled={!canManage}
                              className="h-9 border-0 bg-transparent px-0 font-mono uppercase shadow-none focus-visible:shadow-none"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field
                          label="Documentation style"
                          htmlFor="project-settings-style"
                        >
                          <div
                            id="project-settings-style"
                            className="grid gap-2"
                          >
                            {DOCUMENTATION_STYLES.map((style) => (
                              <label
                                key={style.value}
                                className="group relative flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                              >
                                <input
                                  type="radio"
                                  name="documentationStyle"
                                  value={style.value}
                                  defaultChecked={
                                    (project.documentationStyle ??
                                      DEFAULT_DOCUMENTATION_STYLE) ===
                                    style.value
                                  }
                                  disabled={!canManage}
                                  className="peer sr-only"
                                />
                                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground group-has-[:checked]:border-primary group-has-[:checked]:bg-primary group-has-[:checked]:text-primary-foreground">
                                  <Sparkles />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold">
                                    {style.label}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    {style.description}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </Field>
                        <Field
                          label="Typography"
                          htmlFor="project-settings-font"
                        >
                          <Select
                            name="documentationFont"
                            defaultValue={
                              project.documentationFont ??
                              DEFAULT_DOCUMENTATION_FONT
                            }
                            disabled={!canManage}
                          >
                            <SelectTrigger
                              id="project-settings-font"
                              className="w-full"
                            >
                              <Type />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {DOCUMENTATION_FONTS.map((font) => (
                                  <SelectItem
                                    key={font.value}
                                    value={font.value}
                                  >
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-8">
                        <BrandAssetField
                          asset="logo"
                          label="Logo"
                          description="Shown in the public docs sidebar."
                          value={assets.logo}
                          disabled={!canManage}
                          isUploading={uploadingAsset === "logo"}
                          onUpload={uploadBrandAsset}
                          onRemove={removeBrandAsset}
                        />
                        <BrandAssetField
                          asset="darkLogo"
                          label="Dark Theme Logo"
                          description="Used when docs are viewed in dark mode."
                          value={assets.darkLogo}
                          disabled={!canManage}
                          isUploading={uploadingAsset === "darkLogo"}
                          onUpload={uploadBrandAsset}
                          onRemove={removeBrandAsset}
                        />
                        <BrandAssetField
                          asset="favicon"
                          label="Favicon"
                          description="Used in browser tabs for public docs."
                          value={assets.favicon}
                          disabled={!canManage}
                          isUploading={uploadingAsset === "favicon"}
                          onUpload={uploadBrandAsset}
                          onRemove={removeBrandAsset}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full sm:w-fit"
                        disabled={!canManage || isSaving}
                      >
                        <Save data-icon="inline-start" />
                        {isSaving ? "Saving..." : "Save Settings"}
                      </Button>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </form>

              <BrandPreview
                title={project.title}
                color={previewColor}
                logoUrl={assets.logo.url}
                darkLogoUrl={assets.darkLogo.url}
                faviconUrl={assets.favicon.url}
                styleName={project.documentationStyle ?? "default"}
                fontName={project.documentationFont ?? "sans"}
              />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

function BrandAssetField({
  asset,
  label,
  description,
  value,
  disabled,
  isUploading,
  onUpload,
  onRemove,
}: {
  asset: BrandAsset;
  label: string;
  description: string;
  value: { url: string; fileName: string };
  disabled: boolean;
  isUploading: boolean;
  onUpload: (asset: BrandAsset, file: File | undefined) => Promise<void>;
  onRemove: (asset: BrandAsset) => Promise<void>;
}) {
  const inputId = `project-settings-${asset}`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          htmlFor={inputId}
          className="text-lg font-semibold tracking-[-0.02em]"
        >
          {label}
        </label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {value.url ? (
        <div className="flex min-h-16 max-w-md items-center gap-4 rounded-xl border bg-background px-4 py-3 shadow-[var(--surface-raised-shadow)]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-primary">
            <img
              src={value.url}
              alt=""
              className="max-h-9 max-w-9 object-contain"
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-medium">
            {value.fileName || "Uploaded image"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => void onRemove(asset)}
            className="font-semibold uppercase tracking-[-0.02em]"
          >
            {isUploading ? "Removing..." : "Remove"}
          </Button>
        </div>
      ) : (
        <Button
          asChild
          variant="outline"
          className="w-fit gap-2 rounded-lg bg-muted/60 px-4 text-base text-muted-foreground"
          disabled={disabled || isUploading}
        >
          <label htmlFor={inputId} className="cursor-pointer">
            <Upload data-icon="inline-start" />
            {isUploading ? "Uploading..." : "Upload Image"}
          </label>
        </Button>
      )}
      <Input
        id={inputId}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        disabled={disabled || isUploading}
        onChange={(event) => {
          void onUpload(asset, event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function BrandPreview({
  title,
  color,
  logoUrl,
  darkLogoUrl,
  faviconUrl,
  styleName,
  fontName,
}: {
  title: string;
  color: string;
  logoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  styleName: string;
  fontName: string;
}) {
  const font = getDocumentationFont(fontName);

  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          Approximate public documentation branding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="overflow-hidden rounded-xl border bg-background"
          style={{ "--preview-brand": color } as CSSProperties}
        >
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-[var(--preview-brand)] text-white">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="max-h-7 max-w-8 object-contain"
                  />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {styleName} · {font.label}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[9rem_1fr]">
            <div className="border-r p-3">
              <div className="h-2 w-16 rounded-full bg-[var(--preview-brand)]" />
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-2 rounded-full bg-muted" />
                <div className="h-2 w-3/4 rounded-full bg-muted" />
                <div className="h-2 w-5/6 rounded-full bg-muted" />
              </div>
            </div>
            <div
              className={cn(
                "p-4",
                styleName === "compact" && "p-3",
                styleName === "editorial" && "p-5",
              )}
              style={{ fontFamily: font.family }}
            >
              <div className="h-3 w-20 rounded-full bg-[var(--preview-brand)]/20" />
              <div className="mt-4 h-5 w-3/4 rounded-full bg-foreground/80" />
              <div className="mt-3 flex flex-col gap-2">
                <div className="h-2 rounded-full bg-muted" />
                <div className="h-2 w-11/12 rounded-full bg-muted" />
                <div className="h-2 w-2/3 rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground">
          <p>Favicon: {faviconUrl ? "Uploaded" : "Default app icon"}</p>
          <p>
            Dark logo: {darkLogoUrl ? "Uploaded" : "Falls back to light logo"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
