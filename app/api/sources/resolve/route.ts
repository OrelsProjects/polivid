import { auth } from "@/auth";
import { FetchPageError, UnsafeUrlError } from "@/lib/net/safe-fetch";
import { resolveSourceUrl } from "@/lib/net/source-url";
import { createSource } from "@/lib/studio/sources";
import { MAX_PROMPT_LENGTH } from "@/lib/video/schema";

/** Leaves room in the prompt box for the person to add a line of direction. */
const TEXT_LIMIT = MAX_PROMPT_LENGTH - 500;

/** Reads a public web page and returns its text, so the create form can turn it into a script. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to read a link." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return Response.json({ error: "Paste a link first." }, { status: 400 });
  if (url.length > 2000) return Response.json({ error: "That link is too long." }, { status: 400 });

  try {
    const source = await resolveSourceUrl(url, TEXT_LIMIT);
    await createSource(userId, { title: source.title || source.url, body: source.text }).catch((error: unknown) => {
      // The text is still useful to the form when the library copy fails.
      console.error("Could not save the fetched page as a source", error);
    });
    return Response.json(source);
  } catch (error) {
    if (error instanceof UnsafeUrlError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof FetchPageError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Could not read the link", error);
    return Response.json({ error: "We couldn't read that link. Paste the text instead." }, { status: 502 });
  }
}
