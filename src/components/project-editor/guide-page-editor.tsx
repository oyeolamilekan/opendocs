import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Lock, Trash2 } from "lucide-react";
import { NotionPageEditor } from "../notion-page-editor";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GuidePageDraft } from "./types";

export function GuidePageEditor({
  projectId,
  draft,
  canManage,
  onChange,
  onDelete,
}: {
  projectId: Id<"apiProjects">;
  draft: GuidePageDraft;
  canManage: boolean;
  onChange: (draft: GuidePageDraft) => void;
  onDelete: () => void;
}) {
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

      <NotionPageEditor
        projectId={projectId}
        draft={draft}
        canManage={canManage}
        onChange={onChange}
      />

      {canManage ? (
        <div className="flex justify-end">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete page
          </Button>
        </div>
      ) : null}
    </div>
  );
}
