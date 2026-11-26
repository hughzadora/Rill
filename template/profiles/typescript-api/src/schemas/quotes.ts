import { z } from "zod";

export const quotePath = "/v1/reservation-quotes";
export const quoteMethod = "POST";
export const maxQuoteBytes = 1024;

export const quoteInput = z.strictObject({
  requested: z.int().min(1).max(100),
  available: z.int().min(0).max(100),
});

export const quoteOutput = z.strictObject({ accepted: z.boolean() });

export const quoteErrors = {
  400: "invalid-request",
  404: "not-found",
  405: "method-not-allowed",
  413: "payload-too-large",
  415: "unsupported-media-type",
} as const;

export function quoteError(status: keyof typeof quoteErrors) {
  return z.strictObject({ error: z.literal(quoteErrors[status]) });
}
