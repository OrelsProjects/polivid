export async function* readNdjson<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("This response has no body.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield JSON.parse(trimmed) as T;
    }
  }
  const leftover = buffer.trim();
  if (leftover) yield JSON.parse(leftover) as T;
}

export const ndjsonResponse = (write: (send: (event: unknown) => void) => Promise<void>, status = 200) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client hung up. Keep the work going.
        }
      };
      try {
        await write(send);
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });
  return new Response(stream, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};

export const isNdjson = (response: Response) =>
  (response.headers.get("content-type") ?? "").includes("application/x-ndjson");
