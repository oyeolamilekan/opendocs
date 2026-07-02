import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MailPlus, ShieldCheck, UserRound } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Field, FieldGroup } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { LoadingState } from "../../../components/ui/status";
import { useToast } from "../../../components/ui/toast";
import { getErrorMessage } from "../../../lib/errors";

export const Route = createFileRoute("/app/$organizationSlug/settings")({
  component: SettingsRoute,
});

type PendingDestructiveAction =
  | {
      type: "disable-member";
      member: Doc<"organizationMembers">;
      label: string;
    }
  | {
      type: "revoke-invitation";
      invitation: Doc<"organizationInvitations">;
    };

function SettingsRoute() {
  const { organizationSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug}>
      {(workspace) => <OrganizationSettings workspace={workspace} />}
    </WorkspaceShell>
  );
}

function OrganizationSettings({
  workspace,
}: {
  workspace: {
    organization: Doc<"organizations">;
    membership: Doc<"organizationMembers">;
  };
}) {
  const members = useQuery(api.organizations.listMembers, {
    organizationId: workspace.organization._id,
  });
  const canManage =
    workspace.membership.role === "owner" ||
    workspace.membership.role === "admin";
  const invitations = useQuery(
    api.organizations.listInvitations,
    canManage ? { organizationId: workspace.organization._id } : "skip",
  );
  const invite = useMutation(api.organizations.inviteByEmail);
  const updateMember = useMutation(api.organizations.updateMember);
  const revokeInvitation = useMutation(api.organizations.revokeInvitation);
  const toast = useToast();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingDestructiveAction | null>(null);

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorkingId("invite");
    try {
      const result = await invite({
        organizationId: workspace.organization._id,
        email: String(form.get("email") ?? ""),
        role: String(form.get("role")) as "owner" | "admin" | "member",
      });
      toast.success(
        result.status === "accepted"
          ? "Existing user added to the organization"
          : "Invitation created",
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create invitation"));
    } finally {
      setWorkingId(null);
    }
  }

  async function changeMember(
    member: Doc<"organizationMembers">,
    patch: Partial<Pick<Doc<"organizationMembers">, "role" | "status">>,
  ) {
    setWorkingId(member._id);
    try {
      await updateMember({
        membershipId: member._id,
        role: patch.role ?? member.role,
        status: patch.status ?? member.status,
      });
      toast.success("Member updated");
      return true;
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to update this member. The final active owner cannot be changed.",
        ),
      );
      return false;
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmDestructiveAction() {
    if (!pendingAction) return;

    if (pendingAction.type === "disable-member") {
      const updated = await changeMember(pendingAction.member, {
        status: "disabled",
      });
      if (updated) setPendingAction(null);
      return;
    }

    const { invitation } = pendingAction;
    setWorkingId(invitation._id);
    try {
      await revokeInvitation({ invitationId: invitation._id });
      toast.success("Invitation revoked");
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to revoke invitation"));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="dashboard-route-panel editorial-container py-10">
      <p className="text-sm text-muted-foreground">
        {workspace.organization.name}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
        Organization settings
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage member access, roles, and pending invitations.
      </p>

      {canManage ? (
        <Card className="mt-8 p-6">
          <div className="flex items-center gap-3">
            <MailPlus className="size-5 text-primary" />
            <div>
              <h2 className="font-bold">Invite a member</h2>
              <p className="text-sm text-muted-foreground">
                Existing users are added immediately. New users join when they
                sign up with the invited email.
              </p>
            </div>
          </div>
          <form
            onSubmit={submitInvitation}
            className="mt-5"
          >
            <FieldGroup className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <Field label="Email" htmlFor="invitation-email">
                <Input
                  id="invitation-email"
                  name="email"
                  type="email"
                  required
                  placeholder="member@example.com"
                />
              </Field>
              <Field label="Role" htmlFor="invitation-role">
                <Select name="role" defaultValue="member">
                  <SelectTrigger id="invitation-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {workspace.membership.role === "owner" ? (
                      <SelectItem value="owner">Owner</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </Field>
              <Button disabled={workingId === "invite"} type="submit">
                {workingId === "invite" ? "Inviting..." : "Invite"}
              </Button>
            </FieldGroup>
          </form>
        </Card>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-bold">Members</h2>
        {members === undefined ? (
          <LoadingState label="Loading members" />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {members.map(({ membership, profile }) => {
              const controlsAllowed =
                canManage &&
                (workspace.membership.role === "owner" ||
                  membership.role !== "owner");
              return (
                <Card
                  key={membership._id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <UserRound className="size-5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="font-semibold">
                        {profile
                          ? `${profile.firstName} ${profile.lastName}`.trim()
                          : "Unknown profile"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.email ?? "Profile unavailable"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    {controlsAllowed ? (
                      <>
                        <Select
                          value={membership.role}
                          disabled={workingId === membership._id}
                          onValueChange={(value) =>
                            void changeMember(membership, {
                              role: value as
                                | "owner"
                                | "admin"
                                | "member",
                            })
                          }
                        >
                          <SelectTrigger
                            className="w-28"
                            aria-label={`Role for ${profile?.email ?? "member"}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            {workspace.membership.role === "owner" ? (
                              <SelectItem value="owner">Owner</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                        <Select
                          value={membership.status}
                          disabled={workingId === membership._id}
                          onValueChange={(value) => {
                            if (value === "disabled") {
                              setPendingAction({
                                type: "disable-member",
                                member: membership,
                                label:
                                  profile?.email ||
                                  `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
                                  "this member",
                              });
                              return;
                            }
                            void changeMember(membership, {
                              status: value as "active" | "invited",
                            });
                          }}
                        >
                          <SelectTrigger
                            className="w-28"
                            aria-label={`Status for ${profile?.email ?? "member"}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                        {membership.role} · {membership.status}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {canManage && invitations?.some((item) => item.status === "pending") ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Pending invitations</h2>
          <div className="mt-4 flex flex-col gap-3">
            {invitations
              .filter((invitation) => invitation.status === "pending")
              .map((invitation) => (
                <Card
                  key={invitation._id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <p className="font-semibold">{invitation.email}</p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {invitation.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={workingId === invitation._id}
                    onClick={() =>
                      setPendingAction({
                        type: "revoke-invitation",
                        invitation,
                      })
                    }
                  >
                    Revoke
                  </Button>
                </Card>
              ))}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.type === "disable-member"
            ? "Disable member"
            : "Revoke invitation"
        }
        description={
          pendingAction?.type === "disable-member"
            ? `${pendingAction.label} will immediately lose access to this organization.`
            : `The pending invitation for ${pendingAction?.invitation.email ?? ""} will no longer be valid.`
        }
        confirmLabel={
          pendingAction?.type === "disable-member"
            ? "Disable member"
            : "Revoke invitation"
        }
        isConfirming={
          pendingAction?.type === "disable-member"
            ? workingId === pendingAction.member._id
            : pendingAction?.type === "revoke-invitation"
              ? workingId === pendingAction.invitation._id
              : false
        }
        onConfirm={() => void confirmDestructiveAction()}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}
