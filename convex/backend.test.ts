/// <reference types="vite/client" />

import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import authSchema from "./betterAuth/schema";
import schema from "./schema";
import {
  endpointBodyValidator,
  organizationRoleValidator,
} from "./lib/validators";

const modules = import.meta.glob("./**/*.*s");
const authModules = import.meta.glob("./betterAuth/**/*.*s");

const validatorSchema = defineSchema({
  fixtures: defineTable({
    role: organizationRoleValidator,
    endpointBody: endpointBodyValidator,
  }),
});

function setup() {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", authSchema, authModules);
  return t;
}

async function createAuthenticatedUser(
  t: ReturnType<typeof setup>,
  email: string,
  name = "Test User",
) {
  const { user, session } = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name,
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            token: `session-${user._id}`,
            userId: user._id,
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );

    return { user, session };
  });

  await t.mutation(internal.auth.onAuthCreate, {
    model: "user",
    doc: user,
  });

  const authenticated = t.withIdentity({
    subject: user._id,
    sessionId: session._id,
  });

  return { authenticated, user };
}

function sumMetricSeries(series: Array<{ value: number }>) {
  return series.reduce((total, point) => total + point.value, 0);
}

describe("shared validators", () => {
  it("accepts normalized endpoint and billing fixture data", async () => {
    const t = convexTest(validatorSchema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("fixtures", {
        role: "owner",
        endpointBody: {
          method: "POST",
          path: "/users",
          description: "Create a user",
          parameters: [],
          requestBody: [
            {
              name: "email",
              dataType: "string",
              required: true,
              description: "User email",
            },
          ],
          authHeader: {
            type: "bearer",
            key: "Authorization",
            value: "",
          },
          sampleResponses: [
            {
              statusCode: 201,
              description: "Created",
              body: "{}",
            },
          ],
        },
      }),
    );

    expect(id).toBeDefined();
  });

  it("rejects malformed legacy fixture data", async () => {
    const t = convexTest(validatorSchema, modules);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("fixtures", {
          role: "administrator",
          endpointBody: {
            method: "POST",
            path: "/users",
            description: "",
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                description: "",
                type: "string",
              },
            ],
            requestBody: [],
            authHeader: {
              type: "Bearer Token",
              key: "Authorization",
              value: "",
            },
            sampleResponses: [{ status: 201, body: "{}" }],
          },
        } as never),
      ),
    ).rejects.toThrow();
  });
});

describe("identity and organizations", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(() => {
    t = setup();
  });

  it("provisions exactly one profile for an auth user", async () => {
    const { user } = await createAuthenticatedUser(
      t,
      "profile@example.com",
      "Ada Lovelace",
    );

    await t.mutation(internal.auth.onAuthCreate, {
      model: "user",
      doc: user,
    });

    const profiles = await t.run((ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_auth_user_id", (q) => q.eq("authUserId", user._id))
        .collect(),
    );

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      email: "profile@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  it("creates an organization and owner membership atomically", async () => {
    const { authenticated } = await createAuthenticatedUser(
      t,
      "owner@example.com",
    );
    const organization = await authenticated.mutation(
      api.organizations.create,
      {
        name: "Example Company",
      },
    );

    const memberships = await t.run((ctx) =>
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization!._id),
        )
        .collect(),
    );

    expect(organization?.slug).toBe("example-company");
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      role: "owner",
      status: "active",
    });
  });

  it("returns the existing workspace instead of creating another one", async () => {
    const { authenticated } = await createAuthenticatedUser(
      t,
      "single-workspace@example.com",
    );
    const first = await authenticated.mutation(api.organizations.create, {
      name: "First Workspace",
    });
    const second = await authenticated.mutation(api.organizations.create, {
      name: "Second Workspace",
    });

    const organizations = await t.run((ctx) =>
      ctx.db.query("organizations").collect(),
    );
    const memberships = await authenticated.query(
      api.organizations.listMine,
      {},
    );

    expect(second?._id).toBe(first?._id);
    expect(organizations).toHaveLength(1);
    expect(memberships).toHaveLength(1);
  });

  it("rejects duplicate organization membership", async () => {
    const { authenticated } = await createAuthenticatedUser(
      t,
      "owner@example.com",
    );
    const organization = await authenticated.mutation(
      api.organizations.create,
      {
        name: "Example Company",
      },
    );
    const memberProfileId = await t.run((ctx) =>
      ctx.db.insert("userProfiles", {
        authUserId: "member-auth-id",
        email: "member@example.com",
        firstName: "Member",
        lastName: "User",
        updatedAt: Date.now(),
      }),
    );

    await authenticated.mutation(api.organizations.addMember, {
      organizationId: organization!._id,
      userProfileId: memberProfileId,
      role: "member",
    });

    await expect(
      authenticated.mutation(api.organizations.addMember, {
        organizationId: organization!._id,
        userProfileId: memberProfileId,
        role: "member",
      }),
    ).rejects.toThrow();
  });

  it("claims pending organization invitations when the invited user signs up", async () => {
    const { authenticated } = await createAuthenticatedUser(
      t,
      "owner-invite@example.com",
    );
    const organization = await authenticated.mutation(
      api.organizations.create,
      { name: "Invitation Company" },
    );

    const invitation = await authenticated.mutation(
      api.organizations.inviteByEmail,
      {
        organizationId: organization!._id,
        email: " Invited@Example.com ",
        role: "member",
      },
    );
    expect(invitation.status).toBe("pending");
    expect(invitation.email).toBe("invited@example.com");

    const invited = await createAuthenticatedUser(
      t,
      "invited@example.com",
      "Invited User",
    );
    const memberships = await invited.authenticated.query(
      api.organizations.listMine,
      {},
    );
    const storedInvitation = await t.run((ctx) =>
      ctx.db.get(invitation._id),
    );

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.organization._id).toBe(organization!._id);
    expect(memberships[0]?.membership.role).toBe("member");
    expect(storedInvitation?.status).toBe("accepted");
  });

  it("keeps organization members read-only", async () => {
    const owner = await createAuthenticatedUser(t, "owner-role@example.com");
    const member = await createAuthenticatedUser(t, "member-role@example.com");
    const organization = await owner.authenticated.mutation(
      api.organizations.create,
      { name: "Role Company" },
    );
    await owner.authenticated.mutation(api.organizations.inviteByEmail, {
      organizationId: organization!._id,
      email: "member-role@example.com",
      role: "member",
    });
    const memberships = await member.authenticated.query(
      api.organizations.listMine,
      {},
    );
    const claimedMembership = memberships[0]!.membership;

    expect(claimedMembership.role).toBe("member");
    await expect(
      member.authenticated.mutation(api.organizations.updateMember, {
        membershipId: claimedMembership._id,
        role: "admin",
        status: "active",
      }),
    ).rejects.toThrow();
    await expect(
      member.authenticated.mutation(api.projects.create, {
        organizationId: organization!._id,
        title: "Unauthorized API",
        baseUrl: "https://api.example.com",
        description: "Members cannot create projects",
      }),
    ).rejects.toThrow();
  });

  it("prevents cross-organization reads", async () => {
    const first = await createAuthenticatedUser(t, "first@example.com");
    const second = await createAuthenticatedUser(t, "second@example.com");
    const organization = await first.authenticated.mutation(
      api.organizations.create,
      { name: "First Company" },
    );

    await expect(
      second.authenticated.query(api.organizations.get, {
        organizationId: organization!._id,
      }),
    ).rejects.toThrow();
  });

  it("prevents demoting or disabling the final active owner", async () => {
    const { authenticated } = await createAuthenticatedUser(
      t,
      "owner@example.com",
    );
    const organization = await authenticated.mutation(
      api.organizations.create,
      {
        name: "Example Company",
      },
    );
    const ownerMembership = await t.run((ctx) =>
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization!._id),
        )
        .unique(),
    );

    await expect(
      authenticated.mutation(api.organizations.updateMember, {
        membershipId: ownerMembership!._id as Id<"organizationMembers">,
        role: "admin",
        status: "active",
      }),
    ).rejects.toThrow();
  });
});

describe("API documentation", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(() => {
    t = setup();
  });

  async function createOrganizationAndProject(
    email: string,
    organizationName: string,
    projectTitle = "Customer API",
  ) {
    const account = await createAuthenticatedUser(t, email);
    const organization = await account.authenticated.mutation(
      api.organizations.create,
      { name: organizationName },
    );
    const project = await account.authenticated.mutation(api.projects.create, {
      organizationId: organization!._id,
      title: projectTitle,
      baseUrl: "https://api.example.com",
      description: "Customer API documentation",
    });

    return { ...account, organization: organization!, project: project! };
  }

  it("returns null for stale project and endpoint slugs", async () => {
    const account = await createOrganizationAndProject(
      "stale-slug@example.com",
      "Example Company",
    );

    const missingProject = await account.authenticated.query(
      api.projects.getBySlug,
      {
        organizationId: account.organization._id,
        slug: "missing-project",
      },
    );
    const missingEndpoint = await account.authenticated.query(
      api.endpoints.getBySlug,
      {
        projectId: account.project._id,
        slug: "missing-endpoint",
      },
    );

    expect(missingProject).toBeNull();
    expect(missingEndpoint).toBeNull();
  });

  it("scopes project, section, and endpoint slugs to their parents", async () => {
    const first = await createOrganizationAndProject(
      "first@example.com",
      "First Company",
    );
    const secondProject = await first.authenticated.mutation(
      api.projects.create,
      {
        organizationId: first.organization._id,
        title: "Customer API",
        baseUrl: "https://second.example.com",
        description: "Second project",
      },
    );
    const secondOrganization = await createOrganizationAndProject(
      "second@example.com",
      "Second Company",
    );
    const firstSection = await first.authenticated.mutation(
      api.sections.create,
      { projectId: first.project._id, title: "Users" },
    );
    const duplicateSection = await first.authenticated.mutation(
      api.sections.create,
      { projectId: first.project._id, title: "Users" },
    );
    const otherProjectSection = await first.authenticated.mutation(
      api.sections.create,
      { projectId: secondProject!._id, title: "Users" },
    );
    const firstEndpoint = await first.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: first.project._id,
        sectionId: firstSection!._id,
        title: "Get User",
        endpointType: "endpoint",
      },
    );
    const duplicateEndpoint = await first.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: first.project._id,
        sectionId: firstSection!._id,
        title: "Get User",
        endpointType: "endpoint",
      },
    );

    expect(first.project.slug).toBe("customer-api");
    expect(secondProject?.slug).toBe("customer-api-2");
    expect(secondOrganization.project.slug).toBe("customer-api");
    expect(firstSection?.slug).toBe("users");
    expect(duplicateSection?.slug).toBe("users-2");
    expect(otherProjectSection?.slug).toBe("users");
    expect(firstEndpoint?.slug).toBe("get-user");
    expect(duplicateEndpoint?.slug).toBe("get-user-2");
  });

  it("does not resolve ambiguous public project subdomains", async () => {
    const first = await createOrganizationAndProject(
      "first-public@example.com",
      "First Company",
    );
    const second = await createOrganizationAndProject(
      "second-public@example.com",
      "Second Company",
    );

    await Promise.all([
      first.authenticated.mutation(api.projects.update, {
        projectId: first.project._id,
        visibility: "public",
      }),
      second.authenticated.mutation(api.projects.update, {
        projectId: second.project._id,
        visibility: "public",
      }),
    ]);

    expect(first.project.slug).toBe(second.project.slug);
    expect(
      await t.query(api.projects.getPublicByDomain, {
        projectSlug: first.project.slug,
      }),
    ).toBeNull();
  });

  it("rejects cross-organization project mutations", async () => {
    const first = await createOrganizationAndProject(
      "first@example.com",
      "First Company",
    );
    const second = await createAuthenticatedUser(t, "second@example.com");

    await expect(
      second.authenticated.mutation(api.sections.create, {
        projectId: first.project._id,
        title: "Unauthorized",
      }),
    ).rejects.toThrow();
  });

  it("keeps navigation ordered by explicit positions", async () => {
    const account = await createOrganizationAndProject(
      "owner@example.com",
      "Example Company",
    );
    const firstSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "First" },
    );
    const secondSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "Second" },
    );
    await account.authenticated.mutation(api.endpoints.create, {
      projectId: account.project._id,
      sectionId: firstSection!._id,
      title: "First Endpoint",
      endpointType: "endpoint",
    });
    await account.authenticated.mutation(api.endpoints.create, {
      projectId: account.project._id,
      sectionId: firstSection!._id,
      title: "Second Endpoint",
      endpointType: "doc",
    });

    const navigation = await account.authenticated.query(
      api.sections.navigation,
      { projectId: account.project._id },
    );

    expect(navigation.map((section) => section._id)).toEqual([
      firstSection!._id,
      secondSection!._id,
    ]);
    expect(navigation[0]?.endpoints.map((endpoint) => endpoint.title)).toEqual([
      "First Endpoint",
      "Second Endpoint",
    ]);
  });

  it("preserves endpoint position when saving within the same section", async () => {
    const account = await createOrganizationAndProject(
      "position@example.com",
      "Position Company",
    );
    const section = await account.authenticated.mutation(api.sections.create, {
      projectId: account.project._id,
      title: "Endpoints",
    });
    const firstEndpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: section!._id,
        title: "First Endpoint",
        endpointType: "endpoint",
      },
    );
    await account.authenticated.mutation(api.endpoints.create, {
      projectId: account.project._id,
      sectionId: section!._id,
      title: "Second Endpoint",
      endpointType: "endpoint",
    });

    await account.authenticated.mutation(api.endpoints.update, {
      endpointId: firstEndpoint!._id,
      sectionId: section!._id,
      title: "Updated First Endpoint",
    });

    const navigation = await account.authenticated.query(
      api.sections.navigation,
      { projectId: account.project._id },
    );

    expect(navigation[0]?.endpoints.map((endpoint) => endpoint.title)).toEqual([
      "Updated First Endpoint",
      "Second Endpoint",
    ]);
  });

  it("moves endpoints between sections at an explicit position", async () => {
    const account = await createOrganizationAndProject(
      "move-endpoint@example.com",
      "Move Endpoint Company",
    );
    const sourceSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "Source" },
    );
    const targetSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "Target" },
    );
    const endpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: sourceSection!._id,
        title: "Move Me",
        endpointType: "endpoint",
      },
    );

    await account.authenticated.mutation(api.endpoints.update, {
      endpointId: endpoint!._id,
      sectionId: targetSection!._id,
      position: 0,
    });

    const navigation = await account.authenticated.query(
      api.sections.navigation,
      { projectId: account.project._id },
    );

    expect(navigation[0]?.endpoints).toHaveLength(0);
    expect(navigation[1]?.endpoints.map((item) => item.title)).toEqual([
      "Move Me",
    ]);
  });

  it("persists guide page icon names and includes them in navigation", async () => {
    const account = await createOrganizationAndProject(
      "guide-icons@example.com",
      "Guide Icons Company",
    );
    const guideSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Guides",
      },
    );
    const guidePage = await account.authenticated.mutation(api.guides.create, {
      projectId: account.project._id,
      sectionId: guideSection!._id,
      title: "Getting Started",
      description: "Learn the basics",
    });

    const updatedGuidePage = await account.authenticated.mutation(
      api.guides.update,
      {
        guidePageId: guidePage!._id,
        iconName: "rocket",
      },
    );
    const storedGuidePage = await account.authenticated.query(
      api.guides.getBySlug,
      {
        projectId: account.project._id,
        slug: guidePage!.slug,
      },
    );
    const navigation = await account.authenticated.query(
      api.guides.navigation,
      { projectId: account.project._id },
    );

    expect(updatedGuidePage?.iconName).toBe("rocket");
    expect(storedGuidePage?.iconName).toBe("rocket");
    expect(navigation[0]?.pages[0]).toMatchObject({
      title: "Getting Started",
      description: "Learn the basics",
      iconName: "rocket",
    });
  });

  it("scopes icon names to API documentation pages", async () => {
    const account = await createOrganizationAndProject(
      "api-doc-icons@example.com",
      "API Doc Icons Company",
    );
    const section = await account.authenticated.mutation(api.sections.create, {
      projectId: account.project._id,
      title: "Reference",
    });
    const docPage = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: section!._id,
        title: "Authentication",
        endpointType: "doc",
      },
    );
    const endpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: section!._id,
        title: "List Users",
        endpointType: "endpoint",
      },
    );

    const updatedDocPage = await account.authenticated.mutation(
      api.endpoints.update,
      {
        endpointId: docPage!._id,
        iconName: "key-round",
      },
    );
    const updatedEndpoint = await account.authenticated.mutation(
      api.endpoints.update,
      {
        endpointId: endpoint!._id,
        iconName: "rocket",
      },
    );
    const navigation = await account.authenticated.query(
      api.sections.navigation,
      { projectId: account.project._id },
    );

    expect(updatedDocPage?.iconName).toBe("key-round");
    expect(updatedEndpoint?.iconName).toBeUndefined();
    expect(navigation[0]?.endpoints[0]).toMatchObject({
      title: "Authentication",
      endpointType: "doc",
      iconName: "key-round",
    });
    expect(navigation[0]?.endpoints[1]).toMatchObject({
      title: "List Users",
      endpointType: "endpoint",
    });
    expect(navigation[0]?.endpoints[1]?.iconName).toBeUndefined();

    const convertedDocPage = await account.authenticated.mutation(
      api.endpoints.update,
      {
        endpointId: docPage!._id,
        endpointType: "endpoint",
      },
    );
    const convertedNavigation = await account.authenticated.query(
      api.sections.navigation,
      { projectId: account.project._id },
    );

    expect(convertedDocPage?.iconName).toBeUndefined();
    expect(convertedNavigation[0]?.endpoints[0]).toMatchObject({
      title: "Authentication",
      endpointType: "endpoint",
    });
    expect(convertedNavigation[0]?.endpoints[0]?.iconName).toBeUndefined();
  });

  it("creates guide sections and keeps pages ordered within each section", async () => {
    const account = await createOrganizationAndProject(
      "guides@example.com",
      "Guides Company",
    );
    const firstSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Basics",
      },
    );
    const secondSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Advanced",
      },
    );
    const firstGuide = await account.authenticated.mutation(
      api.guides.create,
      {
        projectId: account.project._id,
        sectionId: firstSection!._id,
        title: "Getting Started",
        content: JSON.stringify({ type: "doc", content: [] }),
        description: "Start here",
      },
    );
    const duplicateGuide = await account.authenticated.mutation(
      api.guides.create,
      {
        projectId: account.project._id,
        sectionId: firstSection!._id,
        title: "Getting Started",
      },
    );
    const advancedGuide = await account.authenticated.mutation(
      api.guides.create,
      {
        projectId: account.project._id,
        sectionId: firstSection!._id,
        title: "Advanced Setup",
      },
    );

    await account.authenticated.mutation(api.guides.update, {
      guidePageId: advancedGuide!._id,
      position: 0,
    });
    await account.authenticated.mutation(api.guides.update, {
      guidePageId: firstGuide!._id,
      position: 1,
    });

    const navigation = await account.authenticated.query(
      api.guides.navigation,
      { projectId: account.project._id },
    );
    const storedGuide = await account.authenticated.query(
      api.guides.getBySlug,
      { projectId: account.project._id, slug: firstGuide!.slug },
    );

    expect(firstGuide?.slug).toBe("getting-started");
    expect(duplicateGuide?.slug).toBe("getting-started-2");
    expect(storedGuide?.description).toBe("Start here");
    expect(navigation.map((section) => section.title)).toEqual([
      "Basics",
      "Advanced",
    ]);
    expect(navigation[0]?.pages.map((page) => page.title)).toEqual([
      "Advanced Setup",
      "Getting Started",
      "Getting Started",
    ]);
    expect(navigation[1]?.pages).toEqual([]);
    expect(secondSection).not.toBeNull();
  });

  it("preserves guide and API doc icon names when copying versions", async () => {
    const account = await createOrganizationAndProject(
      "copy-icons@example.com",
      "Copy Icons Company",
    );
    const apiSection = await account.authenticated.mutation(
      api.sections.create,
      {
        projectId: account.project._id,
        title: "Reference",
      },
    );
    const docPage = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: apiSection!._id,
        title: "Authentication",
        endpointType: "doc",
      },
    );
    await account.authenticated.mutation(api.endpoints.update, {
      endpointId: docPage!._id,
      iconName: "shield-check",
    });
    const guideSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Guides",
      },
    );
    const guidePage = await account.authenticated.mutation(api.guides.create, {
      projectId: account.project._id,
      sectionId: guideSection!._id,
      title: "Getting Started",
    });
    await account.authenticated.mutation(api.guides.update, {
      guidePageId: guidePage!._id,
      iconName: "book-open",
    });
    const defaultVersion = (
      await account.authenticated.query(api.versions.list, {
        projectId: account.project._id,
      })
    ).find((version) => version.isDefault);

    const copiedVersion = await account.authenticated.mutation(
      api.versions.create,
      {
        projectId: account.project._id,
        name: "v2.0",
        copyFromVersionId: defaultVersion!._id,
      },
    );
    const copiedApiNavigation = await account.authenticated.query(
      api.sections.navigation,
      {
        projectId: account.project._id,
        versionId: copiedVersion._id,
      },
    );
    const copiedGuideNavigation = await account.authenticated.query(
      api.guides.navigation,
      {
        projectId: account.project._id,
        versionId: copiedVersion._id,
      },
    );

    expect(copiedApiNavigation[0]?.endpoints[0]).toMatchObject({
      title: "Authentication",
      endpointType: "doc",
      iconName: "shield-check",
    });
    expect(copiedGuideNavigation[0]?.pages[0]).toMatchObject({
      title: "Getting Started",
      iconName: "book-open",
    });
  });

  it("manages version-specific custom navigation and exposes visible links publicly", async () => {
    const account = await createOrganizationAndProject(
      "custom-navigation@example.com",
      "Custom Navigation Company",
    );
    const defaultVersion = (
      await account.authenticated.query(api.versions.list, {
        projectId: account.project._id,
      })
    ).find((version) => version.isDefault);

    const docsLink = await account.authenticated.mutation(
      api.documentationNavigation.create,
      {
        projectId: account.project._id,
        versionId: defaultVersion!._id,
        label: "Docs Home",
        href: "/docs/getting-started",
      },
    );
    const supportLink = await account.authenticated.mutation(
      api.documentationNavigation.create,
      {
        projectId: account.project._id,
        versionId: defaultVersion!._id,
        label: "Support",
        href: "https://support.example.com",
        openInNewTab: true,
      },
    );
    await account.authenticated.mutation(api.documentationNavigation.update, {
      itemId: docsLink._id,
      isVisible: false,
    });
    await account.authenticated.mutation(api.documentationNavigation.reorder, {
      projectId: account.project._id,
      versionId: defaultVersion!._id,
      itemIds: [supportLink._id, docsLink._id],
    });

    const dashboard = await account.authenticated.query(
      api.documentationNavigation.getDashboardBySlug,
      {
        organizationId: account.organization._id,
        projectSlug: account.project.slug,
        versionSlug: defaultVersion!.slug,
      },
    );

    await account.authenticated.mutation(api.projects.update, {
      projectId: account.project._id,
      visibility: "public",
    });
    const publicNavigation = await t.query(
      api.documentationNavigation.publicNavigation,
      {
        organizationSlug: account.organization.slug,
        projectSlug: account.project.slug,
      },
    );

    expect(dashboard?.items.map((item) => item.label)).toEqual([
      "Support",
      "Docs Home",
    ]);
    expect(dashboard?.items[0]).toMatchObject({
      href: "https://support.example.com/",
      openInNewTab: true,
      isVisible: true,
    });
    expect(dashboard?.items[1]).toMatchObject({
      href: "/docs/getting-started",
      isVisible: false,
    });
    expect(publicNavigation.map((item) => item.label)).toEqual(["Support"]);
  });

  it("preserves custom navigation when copying versions", async () => {
    const account = await createOrganizationAndProject(
      "copy-navigation@example.com",
      "Copy Navigation Company",
    );
    const defaultVersion = (
      await account.authenticated.query(api.versions.list, {
        projectId: account.project._id,
      })
    ).find((version) => version.isDefault);
    await account.authenticated.mutation(api.documentationNavigation.create, {
      projectId: account.project._id,
      versionId: defaultVersion!._id,
      label: "Get API Keys",
      href: "https://dashboard.example.com/keys",
      openInNewTab: true,
    });

    const copiedVersion = await account.authenticated.mutation(
      api.versions.create,
      {
        projectId: account.project._id,
        name: "v2.0",
        copyFromVersionId: defaultVersion!._id,
      },
    );
    const copiedNavigation = await account.authenticated.query(
      api.documentationNavigation.list,
      {
        projectId: account.project._id,
        versionId: copiedVersion._id,
      },
    );

    expect(copiedNavigation).toHaveLength(1);
    expect(copiedNavigation[0]).toMatchObject({
      label: "Get API Keys",
      href: "https://dashboard.example.com/keys",
      openInNewTab: true,
      isVisible: true,
    });
  });

  it("deleting an endpoint preserves its section and project", async () => {
    const account = await createOrganizationAndProject(
      "owner@example.com",
      "Example Company",
    );
    const section = await account.authenticated.mutation(api.sections.create, {
      projectId: account.project._id,
      title: "Users",
    });
    const endpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: section!._id,
        title: "Get User",
        endpointType: "endpoint",
      },
    );

    await account.authenticated.mutation(api.endpoints.remove, {
      endpointId: endpoint!._id,
    });

    const remaining = await t.run(async (ctx) => ({
      project: await ctx.db.get(account.project._id),
      section: await ctx.db.get(section!._id),
      endpoint: await ctx.db.get(endpoint!._id),
    }));

    expect(remaining.project).not.toBeNull();
    expect(remaining.section).not.toBeNull();
    expect(remaining.endpoint).toBeNull();
  });

  it("exposes documentation publicly only after explicit publication", async () => {
    const account = await createOrganizationAndProject(
      "owner@example.com",
      "Example Company",
    );

    expect(account.project.themeColor).toBe("emerald");

    await expect(
      t.query(api.projects.getPublic, {
        organizationSlug: account.organization.slug,
        projectSlug: account.project.slug,
      }),
    ).rejects.toThrow();

    await account.authenticated.mutation(api.projects.update, {
      projectId: account.project._id,
      visibility: "public",
      themeColor: "violet",
    });
    const section = await account.authenticated.mutation(api.sections.create, {
      projectId: account.project._id,
      title: "Users",
    });
    const endpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: section!._id,
        title: "Get User",
        endpointType: "endpoint",
        body: {
          method: "GET",
          path: "/users/{id}",
          description: "Get a user",
          parameters: [],
          requestBody: [],
          authHeader: {
            type: "bearer",
            key: "Authorization",
            value: "private-example-token",
          },
          sampleResponses: [],
        },
      },
    );

    const published = await t.query(api.projects.getPublic, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
    });
    const domainProject = await t.query(api.projects.getPublicByDomain, {
      projectSlug: account.project.slug,
    });
    const publicEndpoint = await t.query(api.endpoints.getPublicBySlug, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      endpointSlug: endpoint!.slug,
    });
    const publicReferenceNavigation = await t.query(
      api.sections.publicNavigation,
      {
        organizationSlug: account.organization.slug,
        projectSlug: account.project.slug,
      },
    );
    const guideSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Guides",
      },
    );
    const guide = await account.authenticated.mutation(api.guides.create, {
      projectId: account.project._id,
      sectionId: guideSection!._id,
      title: "Getting Started",
      description: "Public guide",
    });
    const publicGuides = await t.query(api.guides.publicNavigation, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
    });
    const publicGuide = await t.query(api.guides.getPublicBySlug, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      guideSlug: guide!.slug,
    });

    expect(published.project.visibility).toBe("public");
    expect(domainProject).toEqual({
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
    });
    expect(published.project.themeColor).toBe("violet");
    expect(publicEndpoint.body.authHeader.value).toBe("");
    expect(publicReferenceNavigation[0]?.endpoints[0]).toMatchObject({
      title: "Get User",
      description: "Get a user",
    });
    expect(publicGuides.map((section) => section.title)).toEqual(["Guides"]);
    expect(publicGuides[0]?.pages[0]).toMatchObject({
      title: "Getting Started",
      description: "Public guide",
    });
    expect(publicGuide.description).toBe("Public guide");
  });

  it("builds metrics overview from counter-backed analytics", async () => {
    const account = await createOrganizationAndProject(
      "metrics@example.com",
      "Metrics Company",
    );
    await account.authenticated.mutation(api.projects.update, {
      projectId: account.project._id,
      visibility: "public",
    });

    await t.mutation(api.analytics.recordApiCall, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      endpointSlug: "list-users",
      endpointTitle: "List users",
      endpointPath: "/users",
      method: "GET",
      status: 200,
      durationMs: 28,
      userAgent: "Vitest",
    });
    await t.mutation(api.analytics.recordApiCall, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      endpointSlug: "create-user",
      endpointTitle: "Create user",
      endpointPath: "/users",
      method: "POST",
      status: 500,
      durationMs: 83,
      userAgent: "Vitest",
    });
    await t.mutation(api.analytics.recordApiCall, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      endpointSlug: "get-order",
      endpointTitle: "Get order",
      endpointPath: "/orders/{id}",
      method: "GET",
      status: 404,
      durationMs: 41,
      userAgent: "Vitest",
    });
    await t.mutation(api.analytics.recordPageView, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      pageType: "guide",
      pageSlug: "getting-started",
      pageTitle: "Getting started",
    });
    await t.mutation(api.analytics.recordPageView, {
      organizationSlug: account.organization.slug,
      projectSlug: account.project.slug,
      pageType: "reference",
      pageSlug: "list-users",
      pageTitle: "List users",
    });

    const counters = await t.run((ctx) =>
      ctx.db.query("analyticsCounters").collect(),
    );
    expect(counters.map((counter) => counter.dimensionKey)).toEqual(
      expect.arrayContaining([
        "total",
        "method:GET",
        "status:2xx",
        "status:4xx",
        "status:5xx",
        "method-status:GET:2xx",
        "endpoint:/users",
        "method:GET:endpoint:/users",
        "status:4xx:endpoint:/orders/{id}",
        "method-status:GET:4xx:endpoint:/orders/{id}",
      ]),
    );

    const overview = await account.authenticated.query(
      api.analytics.getOverview,
      {
        projectId: account.project._id,
        range: "day",
        method: "all",
        status: "all",
      },
    );
    expect(overview.totals).toEqual({ apiCalls: 3, pageViews: 2 });
    expect(sumMetricSeries(overview.apiSeries)).toBe(3);
    expect(sumMetricSeries(overview.pageSeries)).toBe(2);
    expect(overview.topEndpoints.map((endpoint) => endpoint.path)).toEqual([
      "/users",
      "/orders/{id}",
    ]);
    expect(overview.topEndpoints[0]?.count).toBe(2);
    expect(overview.topPages.map((page) => page.slug).sort()).toEqual([
      "getting-started",
      "list-users",
    ]);
    expect(overview.recentApiCalls).toHaveLength(3);

    const filtered = await account.authenticated.query(
      api.analytics.getOverview,
      {
        projectId: account.project._id,
        range: "day",
        method: "GET",
        status: "4xx",
      },
    );
    expect(filtered.totals.apiCalls).toBe(1);
    expect(sumMetricSeries(filtered.apiSeries)).toBe(1);
    expect(filtered.topEndpoints).toHaveLength(1);
    expect(filtered.topEndpoints[0]).toMatchObject({
      path: "/orders/{id}",
      count: 1,
      method: "GET",
    });
    expect(filtered.recentApiCalls).toHaveLength(1);
    expect(filtered.recentApiCalls[0]).toMatchObject({
      endpointPath: "/orders/{id}",
      method: "GET",
      status: 404,
    });
  });

  it("returns settings page data with versions in one payload", async () => {
    const account = await createOrganizationAndProject(
      "settings-dashboard@example.com",
      "Settings Dashboard Company",
    );

    const settings = await account.authenticated.query(
      api.projects.getSettingsBySlug,
      {
        organizationId: account.organization._id,
        slug: account.project.slug,
      },
    );

    expect(settings?.project._id).toBe(account.project._id);
    expect(settings?.versions.map((version) => version.name)).toEqual(["v1.0"]);
    expect(settings?.logoUrl).toBeUndefined();
    expect(settings?.faviconFileName).toBeUndefined();
  });

  it("returns project dashboard navigation data in one payload", async () => {
    const account = await createOrganizationAndProject(
      "project-dashboard@example.com",
      "Project Dashboard Company",
    );

    const dashboard = await account.authenticated.query(
      api.projects.getDashboardBySlug,
      {
        organizationId: account.organization._id,
        slug: account.project.slug,
      },
    );

    expect(dashboard?.project._id).toBe(account.project._id);
    expect(dashboard?.versions.map((version) => version.name)).toEqual([
      "v1.0",
    ]);
  });

  it("returns AI dashboard data and lightweight conversation summaries", async () => {
    const account = await createOrganizationAndProject(
      "ai-dashboard@example.com",
      "AI Dashboard Company",
    );
    await account.authenticated.mutation(api.projects.update, {
      projectId: account.project._id,
      visibility: "public",
    });

    const dashboard = await account.authenticated.query(
      api.ai.getDashboardBySlug,
      {
        organizationId: account.organization._id,
        slug: account.project.slug,
      },
    );

    expect(dashboard?.project._id).toBe(account.project._id);
    expect(dashboard?.settings).toMatchObject({
      projectId: account.project._id,
      enabled: false,
      displayName: "AI assistant",
    });
    expect(dashboard?.versions.map((version) => version.name)).toEqual([
      "v1.0",
    ]);

    const conversationId = await t.mutation(api.ai.recordPublicConversation, {
      projectId: account.project._id,
      sessionId: "session-1",
      providerMode: "gateway",
      provider: "vercel",
      model: "anthropic/claude-sonnet-4.5",
      messages: [
        {
          role: "user",
          content: "How do I create a customer?",
          createdAt: 10,
        },
        {
          role: "assistant",
          content: "Use the create customer endpoint with a JSON body.",
          createdAt: 20,
        },
      ],
    });

    const summaries = await account.authenticated.query(
      api.ai.listConversationSummaries,
      {
        projectId: account.project._id,
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    const summary = summaries.page[0];

    expect(summary).toMatchObject({
      _id: conversationId,
      messageCount: 2,
      lastMessagePreview:
        "Use the create customer endpoint with a JSON body.",
    });
    expect(summary).not.toHaveProperty("messages");

    const fullConversation = await account.authenticated.query(
      api.ai.getConversation,
      { conversationId },
    );
    expect(fullConversation?.messages).toHaveLength(2);
  });

  it("cascades section and project deletion explicitly", async () => {
    const account = await createOrganizationAndProject(
      "owner@example.com",
      "Example Company",
    );
    const firstSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "Users" },
    );
    const sectionEndpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: firstSection!._id,
        title: "Get User",
        endpointType: "endpoint",
      },
    );

    await account.authenticated.mutation(api.sections.remove, {
      sectionId: firstSection!._id,
    });

    const afterSectionDelete = await t.run(async (ctx) => ({
      section: await ctx.db.get(firstSection!._id),
      endpoint: await ctx.db.get(sectionEndpoint!._id),
      project: await ctx.db.get(account.project._id),
    }));
    expect(afterSectionDelete.section).toBeNull();
    expect(afterSectionDelete.endpoint).toBeNull();
    expect(afterSectionDelete.project).not.toBeNull();

    const secondSection = await account.authenticated.mutation(
      api.sections.create,
      { projectId: account.project._id, title: "Orders" },
    );
    const projectEndpoint = await account.authenticated.mutation(
      api.endpoints.create,
      {
        projectId: account.project._id,
        sectionId: secondSection!._id,
        title: "Get Order",
        endpointType: "endpoint",
      },
    );
    const guideSection = await account.authenticated.mutation(
      api.guideSections.create,
      {
        projectId: account.project._id,
        title: "Guides",
      },
    );
    const guidePage = await account.authenticated.mutation(api.guides.create, {
      projectId: account.project._id,
      sectionId: guideSection!._id,
      title: "Getting Started",
    });

    await account.authenticated.mutation(api.projects.remove, {
      projectId: account.project._id,
    });

    const afterProjectDelete = await t.run(async (ctx) => ({
      project: await ctx.db.get(account.project._id),
      section: await ctx.db.get(secondSection!._id),
      endpoint: await ctx.db.get(projectEndpoint!._id),
      guideSection: await ctx.db.get(guideSection!._id),
      guidePage: await ctx.db.get(guidePage!._id),
    }));
    expect(afterProjectDelete).toEqual({
      project: null,
      section: null,
      endpoint: null,
      guideSection: null,
      guidePage: null,
    });
  });
});

describe("waitlist", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(() => {
    t = setup();
  });

  it("normalizes emails and prevents duplicate entries", async () => {
    expect(
      await t.mutation(api.waitlist.join, {
        email: "  PERSON@Example.COM ",
        source: " landing-page ",
      }),
    ).toEqual({ joined: true, alreadyJoined: false });
    expect(
      await t.mutation(api.waitlist.join, {
        email: "person@example.com",
      }),
    ).toEqual({ joined: false, alreadyJoined: true });

    const entries = await t.run((ctx) =>
      ctx.db.query("waitlistEntries").collect(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      email: "person@example.com",
      source: "landing-page",
      status: "pending",
    });
  });

  it("rejects invalid emails and rate-limits repeated requests", async () => {
    await expect(
      t.mutation(api.waitlist.join, { email: "not-an-email" }),
    ).rejects.toThrow();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await t.mutation(api.waitlist.join, { email: "limited@example.com" });
    }
    await expect(
      t.mutation(api.waitlist.join, { email: "limited@example.com" }),
    ).rejects.toThrow();
  });

  it("does not store honeypot submissions", async () => {
    await t.mutation(api.waitlist.join, {
      email: "bot@example.com",
      website: "https://spam.example.com",
    });

    expect(
      await t.run((ctx) => ctx.db.query("waitlistEntries").collect()),
    ).toHaveLength(0);
  });
});

describe("OpenAPI import", () => {
  let t: ReturnType<typeof setup>;

  beforeEach(() => {
    t = setup();
  });

  async function createProject(email = "importer@example.com") {
    const account = await createAuthenticatedUser(t, email);
    const organization = await account.authenticated.mutation(
      api.organizations.create,
      { name: "Import Company" },
    );
    const project = await account.authenticated.mutation(api.projects.create, {
      organizationId: organization!._id,
      title: "Imported API",
      baseUrl: "https://api.example.com",
      description: "Imported API documentation",
    });
    return { ...account, project: project! };
  }

  const jsonSpecification = JSON.stringify({
    openapi: "3.1.0",
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/users/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Users"],
          summary: "Get User",
          description: "Returns one user.",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  example: { id: "user_123" },
                },
              },
            },
          },
        },
      },
    },
  });

  it("imports JSON and replaces repeated imports without duplicates", async () => {
    const account = await createProject();

    const first = await account.authenticated.action(
      api.openapi.importSpecification,
      {
        projectId: account.project._id,
        content: jsonSpecification,
        format: "json",
      },
    );
    const second = await account.authenticated.action(
      api.openapi.importSpecification,
      {
        projectId: account.project._id,
        content: jsonSpecification,
        format: "json",
      },
    );

    const imported = await t.run(async (ctx) => ({
      sections: await ctx.db.query("apiSections").collect(),
      endpoints: await ctx.db.query("apiEndpoints").collect(),
    }));
    expect(first).toEqual({
      sectionCount: 1,
      endpointCount: 1,
      conflictPolicy: "replace",
    });
    expect(second).toEqual(first);
    expect(imported.sections).toHaveLength(1);
    expect(imported.endpoints).toHaveLength(1);
    expect(imported.endpoints[0].body).toMatchObject({
      method: "GET",
      path: "/users/{id}",
      authHeader: { type: "bearer", key: "Authorization", value: "" },
    });
  });

  it("imports YAML and normalizes request bodies", async () => {
    const account = await createProject();
    const specification = `
openapi: 3.0.3
paths:
  /users:
    post:
      tags: [Users]
      summary: Create User
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email:
                  type: string
                  description: User email
                profile:
                  type: object
                  properties:
                    first_name:
                      type: string
                      description: First name
      responses:
        "201":
          description: Created
`;

    await account.authenticated.action(api.openapi.importSpecification, {
      projectId: account.project._id,
      content: specification,
      format: "yaml",
    });

    const endpoint = await t.run((ctx) =>
      ctx.db.query("apiEndpoints").unique(),
    );
    expect(endpoint?.body.requestBody).toEqual([
      {
        name: "email",
        dataType: "string",
        required: true,
        description: "User email",
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
            description: "First name",
          },
        ],
      },
    ]);
  });

  it("rejects invalid input without changing existing documentation", async () => {
    const account = await createProject();
    const section = await account.authenticated.mutation(api.sections.create, {
      projectId: account.project._id,
      title: "Existing",
    });

    await expect(
      account.authenticated.action(api.openapi.importSpecification, {
        projectId: account.project._id,
        content: '{"openapi":"2.0","paths":{}}',
        format: "json",
      }),
    ).rejects.toThrow();

    expect(await t.run((ctx) => ctx.db.get(section!._id))).not.toBeNull();
  });

  it("requires an owner or admin in the project organization", async () => {
    const owner = await createProject("owner-import@example.com");
    const outsider = await createAuthenticatedUser(
      t,
      "outsider-import@example.com",
    );

    await expect(
      outsider.authenticated.action(api.openapi.importSpecification, {
        projectId: owner.project._id,
        content: jsonSpecification,
        format: "json",
      }),
    ).rejects.toThrow();
  });
});
