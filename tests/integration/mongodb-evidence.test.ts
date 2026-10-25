import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { initializeEvidence } from "@/lib/evidence";
const uri = process.env.TEST_MONGODB_URI;
let client: MongoClient, db: Db;
beforeAll(async () => {
  if (uri) {
    client = await new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
    }).connect();
    db = client.db(`ledger_test_${randomUUID().replaceAll("-", "")}`);
  }
});
afterAll(async () => {
  if (client) {
    await db.dropDatabase();
    await client.close();
  }
});
describe.skipIf(!uri)("MongoDB evidence storage", () => {
  it("enforces document validation, indexes, idempotent upsert, and aggregation", async () => {
    const collection = await initializeEvidence(db);
    await expect(
      collection.insertOne({ reportId: randomUUID() } as never),
    ).rejects.toMatchObject({ code: 121 });
    const reportId = randomUUID(),
      now = new Date();
    const doc = {
      _id: randomUUID(),
      reportId,
      submittedByUserId: randomUUID(),
      reproduction: {
        steps: ["Local reproduction"],
        expectedBehavior: "Safe",
        observedBehavior: "Unsafe",
      },
      affectedComponents: ["search", "auth"],
      technicalMetadata: { browser: "local" },
      createdAt: now,
      updatedAt: now,
    };
    await collection.updateOne(
      { _id: doc._id },
      { $setOnInsert: doc },
      { upsert: true },
    );
    await collection.updateOne(
      { _id: doc._id },
      { $setOnInsert: doc },
      { upsert: true },
    );
    await collection.insertOne({
      ...doc,
      _id: randomUUID(),
      affectedComponents: ["search"],
    });
    expect(await collection.countDocuments({ reportId })).toBe(2);
    expect(
      (await collection.indexes()).map((index) => index.key),
    ).toContainEqual({ reportId: 1, createdAt: -1 });
    const result = await collection
      .aggregate([
        { $unwind: "$affectedComponents" },
        { $group: { _id: "$affectedComponents", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ])
      .toArray();
    expect(result).toEqual([
      { _id: "search", total: 2 },
      { _id: "auth", total: 1 },
    ]);
  });
});
