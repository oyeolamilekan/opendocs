export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as {
        data?: { message?: string };
        message?: string;
      };
      return parsed.data?.message ?? parsed.message ?? error.message;
    } catch {
      return error.message;
    }
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: string;
      data?: { message?: string };
      error?: { message?: string };
    };
    return (
      candidate.data?.message ??
      candidate.error?.message ??
      candidate.message ??
      fallback
    );
  }

  return fallback;
}
