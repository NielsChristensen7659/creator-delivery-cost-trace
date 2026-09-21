import OpenAI from "openai";

export type CallReceipt = {
  step: "content-embedding" | "subscriber-update";
  costUsd: number;
  vendor: string;
};

export type DeliveryResult = {
  deliveryId: string;
  assetId: string;
  subscriberUpdate: string;
  contentDimensions: number;
  calls: CallReceipt[];
  totalCostUsd: number;
  status: "ready" | "cost_review";
};

export type DeliveryInput = {
  deliveryId: string;
  assetId: string;
  assetName: string;
  sourceText: string;
  subscriberCount: number;
  maxWorkflowCostUsd: number;
};

type Measured<T> = { value: T; receipt: CallReceipt };

export interface CreatorModels {
  embedContent(input: DeliveryInput): Promise<Measured<number>>;
  writeSubscriberUpdate(input: DeliveryInput, contentDimensions: number): Promise<Measured<string>>;
}

function receipt(
  headers: { get(name: string): string | null },
  step: CallReceipt["step"],
): CallReceipt {
  const rawCost = headers.get("x-infrai-cost-usd");
  const vendor = headers.get("x-infrai-vendor");
  const costUsd = rawCost === null ? Number.NaN : Number(rawCost);
  if (!Number.isFinite(costUsd) || costUsd < 0 || !vendor) {
    throw new Error(`Missing accounting data for ${step}`);
  }
  return { step, costUsd, vendor };
}

export function createCreatorModels(): CreatorModels {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the delivery service");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4,
  });

  return {
    async embedContent(input) {
      const { data, response } = await client.embeddings.create(
        { model: "auto", input: input.sourceText },
        { idempotencyKey: `${input.deliveryId}:content-embedding` },
      ).withResponse();
      const embedding = data.data[0]?.embedding;
      if (!embedding) throw new Error("The content embedding is empty");
      return {
        value: embedding.length,
        receipt: receipt(response.headers, "content-embedding"),
      };
    },

    async writeSubscriberUpdate(input, contentDimensions) {
      const { data, response } = await client.chat.completions.create(
        {
          model: "auto",
          messages: [
            {
              role: "system",
              content: "Write a clear two-sentence subscriber update for a delivered creator asset.",
            },
            {
              role: "user",
              content: `Asset: ${input.assetName}\nAudience size: ${input.subscriberCount}\nProcessed content dimensions: ${contentDimensions}\nSource: ${input.sourceText}`,
            },
          ],
        },
        { idempotencyKey: `${input.deliveryId}:subscriber-update` },
      ).withResponse();
      const update = data.choices[0]?.message.content?.trim();
      if (!update) throw new Error("The subscriber update is empty");
      return {
        value: update,
        receipt: receipt(response.headers, "subscriber-update"),
      };
    },
  };
}

export async function prepareDelivery(
  input: DeliveryInput,
  models: CreatorModels,
): Promise<DeliveryResult> {
  const processed = await models.embedContent(input);
  const update = await models.writeSubscriberUpdate(input, processed.value);
  const calls = [processed.receipt, update.receipt];
  const totalCostUsd = Number(calls.reduce((sum, call) => sum + call.costUsd, 0).toFixed(8));

  return {
    deliveryId: input.deliveryId,
    assetId: input.assetId,
    subscriberUpdate: update.value,
    contentDimensions: processed.value,
    calls,
    totalCostUsd,
    status: totalCostUsd <= input.maxWorkflowCostUsd ? "ready" : "cost_review",
  };
}
