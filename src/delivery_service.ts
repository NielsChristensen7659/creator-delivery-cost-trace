import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { createCreatorModels, prepareDelivery, type DeliveryResult } from "./costed_creator_pipeline.js";

const deliveryRequest = z.object({
  deliveryId: z.string().min(1),
  assetId: z.string().min(1),
  assetName: z.string().min(1).max(160),
  sourceText: z.string().min(1).max(12000),
  subscriberCount: z.number().int().positive(),
  maxWorkflowCostUsd: z.number().nonnegative(),
}).strict();

const completed = new Map<string, DeliveryResult>();

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function clientStatus(error: unknown): number {
  if (error instanceof OpenAI.APIError && error.status >= 400 && error.status < 500) {
    return error.status;
  }
  return 502;
}

export async function handleDelivery(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST" || request.url !== "/deliveries") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  const idempotencyKey = request.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    sendJson(response, 400, { error: "Idempotency-Key is required" });
    return;
  }

  const existing = completed.get(idempotencyKey);
  if (existing) {
    sendJson(response, 200, existing);
    return;
  }

  try {
    const parsed = deliveryRequest.safeParse(await readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { error: "Invalid delivery request", details: z.flattenError(parsed.error) });
      return;
    }
    const result = await prepareDelivery(parsed.data, createCreatorModels());
    completed.set(idempotencyKey, result);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, clientStatus(error), {
      error: error instanceof Error ? error.message : "Delivery processing failed",
    });
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const port = Number(process.env.PORT ?? 3000);
  createServer((request, response) => void handleDelivery(request, response)).listen(port, () => {
    console.log(`Creator delivery service listening on http://localhost:${port}`);
  });
}
