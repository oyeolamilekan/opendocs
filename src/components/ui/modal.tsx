import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? "Complete this form to continue."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100svh-10rem)] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
