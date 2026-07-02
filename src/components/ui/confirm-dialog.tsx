import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "./alert-dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isConfirming = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isConfirming) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <CircleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isConfirming}
          >
            {isConfirming ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
