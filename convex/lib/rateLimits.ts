import { defineRateLimits } from "convex-helpers/server/rateLimit";

const HOUR = 60 * 60 * 1000;

export const { rateLimit } = defineRateLimits({
  waitlistEmail: {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  waitlistSource: {
    kind: "fixed window",
    rate: 20,
    period: HOUR,
  },
});
