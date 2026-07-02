import { toast } from "sonner";

export function useToast() {
  return {
    success: toast.success,
    error: toast.error,
  };
}
