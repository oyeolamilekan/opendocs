import { ConvexError } from "convex/values";

export const ERROR_CODES = {
  unauthenticated: "UNAUTHENTICATED",
  profileNotFound: "PROFILE_NOT_FOUND",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  validation: "VALIDATION_ERROR",
  rateLimited: "RATE_LIMITED",
  lastOwner: "LAST_OWNER",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const appError = (
  code: ErrorCode,
  message: string,
): ConvexError<{ code: ErrorCode; message: string }> => {
  return new ConvexError({ code, message });
};
