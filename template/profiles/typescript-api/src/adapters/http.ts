import { canAccommodate } from "@/domain/capacity";
import {
  maxQuoteBytes,
  quoteError,
  quoteErrors,
  quoteInput,
  quoteMethod,
  quoteOutput,
  quotePath,
} from "../schemas/quotes";

function errorResponse(status: keyof typeof quoteErrors): Response {
  const headers = new Headers();
  if (status === 405) headers.set("Allow", quoteMethod);
  return Response.json(quoteError(status).parse({ error: quoteErrors[status] }), {
    status,
    headers,
  });
}

async function parseQuote(body: ReadableStream<Uint8Array> | null) {
  if (body === null) return { status: 400 } as const;
  const reader = body.getReader();
  const bytes = new Uint8Array(maxQuoteBytes);
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxQuoteBytes) {
        await reader.cancel();
        return { status: 413 } as const;
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    const payload: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)),
    );
    const result = quoteInput.safeParse(payload);
    if (!result.success) return { status: 400 } as const;
    return { status: 200, data: result.data } as const;
  } catch {
    return { status: 400 } as const;
  } finally {
    reader.releaseLock();
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  if (new URL(request.url).pathname !== quotePath) return errorResponse(404);
  if (request.method !== quoteMethod) return errorResponse(405);
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") return errorResponse(415);
  const input = await parseQuote(request.body);
  if (input.status !== 200) return errorResponse(input.status);
  const { requested, available } = input.data;
  return Response.json(quoteOutput.parse({ accepted: canAccommodate(requested, available) }));
}
