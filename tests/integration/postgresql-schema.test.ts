import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function transactional(test: (client: PoolClient) => Promise<void>) { const client = await pool.connect(); try { await client.query("BEGIN"); await test(client); } finally { await client.query("ROLLBACK"); client.release(); } }
async function expectConstraintError(client: PoolClient, statement: string, values: unknown[], code: string) {
  await client.query("SAVEPOINT expected_constraint_error");
  try { await client.query(statement, values); throw new Error("Expected database constraint failure"); }
  catch (error: unknown) { expect(error).toMatchObject({ code }); }
  finally { await client.query("ROLLBACK TO SAVEPOINT expected_constraint_error"); }
}
beforeAll(async () => { await pool.query("SELECT 1"); }); afterAll(async () => { await pool.end(); });
describe("PostgreSQL schema integration", () => {
  it("creates history and rejects an invalid status transition", async () => transactional(async (client) => {
    const user = await client.query<{ id: string }>("INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id", ["schema-test@example.local", "Schema Test", "non-secret-test-hash"]);
    const report = await client.query<{ id: string }>("INSERT INTO vulnerability_reports (title, description, affected_asset, reporter_id) VALUES ($1, $2, $3, $4) RETURNING id", ["Valid report title", "This description is long enough to satisfy the database integrity rule.", "test.local", user.rows[0].id]);
    expect((await client.query("SELECT * FROM report_status_history WHERE report_id = $1", [report.rows[0].id])).rowCount).toBe(1);
    await expectConstraintError(client, "UPDATE vulnerability_reports SET status = 'ACCEPTED' WHERE id = $1", [report.rows[0].id], "23514");
    await client.query("UPDATE vulnerability_reports SET status = 'UNDER_REVIEW', last_status_changed_by = $1 WHERE id = $2", [user.rows[0].id, report.rows[0].id]);
    expect((await client.query("SELECT * FROM report_status_history WHERE report_id = $1", [report.rows[0].id])).rowCount).toBe(2);
  }));
  it("prevents non-positive and duplicate payouts", async () => transactional(async (client) => {
    const user = await client.query<{ id: string }>("INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id", ["payout-test@example.local", "Payout Test", "non-secret-test-hash"]);
    const report = await client.query<{ id: string }>("INSERT INTO vulnerability_reports (title, description, affected_asset, reporter_id) VALUES ($1, $2, $3, $4) RETURNING id", ["Payout test report", "This description is long enough for the payout integrity test case.", "payout-test.local", user.rows[0].id]);
    await expectConstraintError(client, "INSERT INTO bounty_payouts (report_id, amount, reference, recorded_by_id) VALUES ($1, 0, $2, $3)", [report.rows[0].id, "PAYOUT-ZERO", user.rows[0].id], "23514");
    await client.query("INSERT INTO bounty_payouts (report_id, amount, reference, recorded_by_id) VALUES ($1, 2500, $2, $3)", [report.rows[0].id, "PAYOUT-ONE", user.rows[0].id]);
    await expectConstraintError(client, "INSERT INTO bounty_payouts (report_id, amount, reference, recorded_by_id) VALUES ($1, 3000, $2, $3)", [report.rows[0].id, "PAYOUT-TWO", user.rows[0].id], "23505");
  }));
});
