import { createHash } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import { z } from "zod";

const text = z.string().trim().min(1).max(2000);
export const evidenceSchema = z
  .object({
    reproduction: z
      .object({
        steps: z.array(text).min(1).max(30),
        expectedBehavior: text,
        observedBehavior: text,
      })
      .strict(),
    affectedComponents: z
      .array(z.string().trim().min(1).max(120))
      .min(1)
      .max(30)
      .transform((values) => [...new Set(values)]),
    technicalMetadata: z
      .record(z.string().min(1).max(80), z.string().max(500))
      .refine(
        (value) => Object.keys(value).length <= 30,
        "At most 30 metadata entries.",
      ),
    sanitizedPocNotes: z.string().trim().max(5000).optional(),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema> & {
  _id: string;
  reportId: string;
  submittedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};
const schema = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "_id",
      "reportId",
      "submittedByUserId",
      "reproduction",
      "affectedComponents",
      "technicalMetadata",
      "createdAt",
      "updatedAt",
    ],
    additionalProperties: false,
    properties: {
      _id: { bsonType: "string" },
      reportId: { bsonType: "string", pattern: "^[0-9a-f-]{36}$" },
      submittedByUserId: { bsonType: "string", pattern: "^[0-9a-f-]{36}$" },
      reproduction: {
        bsonType: "object",
        required: ["steps", "expectedBehavior", "observedBehavior"],
        additionalProperties: false,
        properties: {
          steps: {
            bsonType: "array",
            minItems: 1,
            maxItems: 30,
            items: { bsonType: "string", minLength: 1, maxLength: 2000 },
          },
          expectedBehavior: {
            bsonType: "string",
            minLength: 1,
            maxLength: 2000,
          },
          observedBehavior: {
            bsonType: "string",
            minLength: 1,
            maxLength: 2000,
          },
        },
      },
      affectedComponents: {
        bsonType: "array",
        minItems: 1,
        maxItems: 30,
        uniqueItems: true,
        items: { bsonType: "string", minLength: 1, maxLength: 120 },
      },
      technicalMetadata: {
        bsonType: "object",
        maxProperties: 30,
        additionalProperties: { bsonType: "string", maxLength: 500 },
      },
      sanitizedPocNotes: { bsonType: "string", maxLength: 5000 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};
export async function initializeEvidence(db: Db) {
  try {
    await db.createCollection("report_evidence", { validator: schema });
  } catch (error) {
    if ((error as { code?: number }).code !== 48) throw error;
  }
  // Also update validation for collections created by earlier versions.
  await db.command({
    collMod: "report_evidence",
    validator: schema,
    validationLevel: "strict",
  });
  const collection = db.collection<Evidence>("report_evidence");
  await collection.createIndex({ reportId: 1, createdAt: -1 });
  await collection.createIndex({ affectedComponents: 1 });
  return collection;
}
let connection:
  Promise<Awaited<ReturnType<typeof initializeEvidence>>> | undefined;
let client: MongoClient | undefined;
export async function evidenceCollection() {
  if (!connection)
    connection = (async () => {
      if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME)
        throw new Error("MongoDB is not configured.");
      client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      await client.connect();
      return initializeEvidence(client.db(process.env.MONGODB_DB_NAME));
    })().catch(async (error) => {
      connection = undefined;
      await client?.close();
      throw error;
    });
  return await connection;
}
export async function componentSummary(reportIds?: string[]) {
  const collection = await evidenceCollection();
  return collection
    .aggregate<{ component: string; evidenceCount: number }>([
      ...(reportIds ? [{ $match: { reportId: { $in: reportIds } } }] : []),
      { $unwind: "$affectedComponents" },
      { $group: { _id: "$affectedComponents", evidenceCount: { $sum: 1 } } },
      { $sort: { evidenceCount: -1, _id: 1 } },
      { $project: { _id: 0, component: "$_id", evidenceCount: 1 } },
    ])
    .toArray();
}
export function payloadHash(value: unknown) {
  // Normalize nested metadata key order to make semantically identical retries equal.
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normalize)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, item]) => [k, normalize(item)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(normalize(value)))
    .digest("hex");
}
export function completionId(operationId: string) {
  const h = createHash("sha256")
    .update(`evidence-completed:${operationId}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
