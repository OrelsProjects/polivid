import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

type ErrorBody = {
  error?: string;
  code?: string;
  required?: number;
  balance?: number;
};

export const isFetchBaseQueryError = (error: unknown): error is FetchBaseQueryError =>
  typeof error === "object" && error !== null && "status" in error;

const errorBody = (error: unknown): ErrorBody | null => {
  if (!isFetchBaseQueryError(error)) return null;
  return typeof error.data === "object" && error.data !== null ? (error.data as ErrorBody) : null;
};

/** HTTP status of a failed request, or null for network and parsing failures. */
export const apiErrorStatus = (error: unknown) =>
  isFetchBaseQueryError(error) && typeof error.status === "number" ? error.status : null;

/** The route's `{ error }` message, or the fallback when it sent none. */
export const apiErrorMessage = (error: unknown, fallback: string) => errorBody(error)?.error ?? fallback;

/** Credit shortfall from a 402 `insufficient_credits` response, or null for any other error. */
export const insufficientCredits = (error: unknown) => {
  const body = errorBody(error);
  if (apiErrorStatus(error) !== 402 || body?.code !== "insufficient_credits") return null;
  return { required: body.required ?? 0, balance: body.balance ?? 0 };
};

export const loginPath = (callbackUrl: string) => `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
