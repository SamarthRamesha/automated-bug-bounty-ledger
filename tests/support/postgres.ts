import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
export const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 3000,
});
export const hasPostgres = !!process.env.TEST_DATABASE_URL;
export async function transactional(
  test: (client: PoolClient) => Promise<void>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await test(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
export async function fixture(client: PoolClient) {
  const owner = (
    await client.query<{ id: string }>(
      "INSERT INTO users(email,display_name,password_hash) VALUES ($1,'Test researcher','test-only') RETURNING id",
      [`test-${randomUUID()}@example.local`],
    )
  ).rows[0].id;
  const admin = (
    await client.query<{ id: string }>(
      "INSERT INTO users(email,display_name,password_hash) VALUES ($1,'Test admin','test-only') RETURNING id",
      [`test-${randomUUID()}@example.local`],
    )
  ).rows[0].id;
  const id = (
    await client.query<{ id: string }>(
      "INSERT INTO vulnerability_reports(title,description,affected_asset,reporter_id) VALUES ('Integration test report','A sanitized local report description for testing constraints.','demo.local',$1) RETURNING id",
      [owner],
    )
  ).rows[0].id;
  return { id, owner, admin };
}
export async function remediate(client: PoolClient, id: string, admin: string) {
  for (const status of ["UNDER_REVIEW", "ACCEPTED", "REMEDIATING"])
    await client.query(
      'UPDATE vulnerability_reports SET status=$1::"ReportStatus",last_status_changed_by=$2 WHERE id=$3',
      [status, admin, id],
    );
}
export async function patch(
  client: PoolClient,
  id: string,
  admin: string,
  reference = "test-v1",
) {
  return (
    await client.query<{ id: string }>(
      "INSERT INTO patches(report_id,summary,reference,patched_at,submitted_by_id) VALUES ($1,'Fixed input validation',$2,now(),$3) RETURNING id",
      [id, reference, admin],
    )
  ).rows[0].id;
}
export async function approve(
  client: PoolClient,
  patchId: string,
  admin: string,
) {
  await client.query(
    "UPDATE patches SET review_status='APPROVED',reviewed_by_id=$1,reviewed_at=now() WHERE id=$2",
    [admin, patchId],
  );
}
export async function close(client: PoolClient, id: string, admin: string) {
  for (const status of ["PATCHED", "CLOSED"])
    await client.query(
      'UPDATE vulnerability_reports SET status=$1::"ReportStatus",last_status_changed_by=$2 WHERE id=$3',
      [status, admin, id],
    );
}
export async function constraint(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code = "23514",
) {
  await client.query("SAVEPOINT expected_failure");
  try {
    await client.query(sql, values);
    throw new Error("Expected constraint failure");
  } catch (error) {
    if ((error as { code?: string }).code !== code) throw error;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_failure");
  }
}
