"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { checkAuthorizeRequest } from "@/lib/mcp/auth/authorize-request";
import { redirectWith } from "@/lib/mcp/auth/oauth";
import { issueAuthorizationCode } from "@/lib/mcp/auth/store";

const FIELDS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;

/** Approve or deny. Everything is checked again here: the hidden fields are only a copy of the query string. */
export const decideAuthorization = async (formData: FormData) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const params = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));
  const check = await checkAuthorizeRequest(params);
  if (check.kind === "fatal") throw new Error(check.message);
  if (check.kind === "redirect") redirect(check.url);
  if (formData.get("decision") !== "approve") {
    redirect(redirectWith(check.redirectUri, { error: "access_denied", error_description: "The person declined.", state: check.state }));
  }
  const code = await issueAuthorizationCode({
    clientId: check.clientId,
    userId,
    redirectUri: check.redirectUri,
    codeChallenge: check.codeChallenge,
    resource: check.resource,
  });
  redirect(redirectWith(check.redirectUri, { code, state: check.state }));
};
