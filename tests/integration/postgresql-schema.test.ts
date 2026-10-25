import { afterAll, describe, expect, it } from "vitest";
import {
  approve,
  close,
  constraint,
  fixture,
  hasPostgres,
  patch,
  pool,
  remediate,
  transactional,
} from "../support/postgres";
afterAll(() => pool.end());
describe.skipIf(!hasPostgres)("PostgreSQL workflow constraints", () => {
  it("records initial history/audit, attributes changes, and guards transitions", () =>
    transactional(async (client) => {
      const { id, owner, admin } = await fixture(client);
      expect(
        (
          await client.query(
            "SELECT changed_by_id,to_status FROM report_status_history WHERE report_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ changed_by_id: owner, to_status: "SUBMITTED" }]);
      expect(
        (
          await client.query(
            "SELECT actor_id FROM audit_logs WHERE entity_id=$1 AND action='REPORT_SUBMITTED'",
            [id],
          )
        ).rows[0].actor_id,
      ).toBe(owner);
      await constraint(
        client,
        "UPDATE vulnerability_reports SET status='ACCEPTED' WHERE id=$1",
        [id],
      );
      await remediate(client, id, admin);
      expect(
        (
          await client.query(
            "SELECT actor_id FROM audit_logs WHERE entity_id=$1 AND action='REPORT_STATUS_CHANGED'",
            [id],
          )
        ).rows.every((row) => row.actor_id === admin),
      ).toBe(true);
      await constraint(
        client,
        "UPDATE vulnerability_reports SET status='PATCHED' WHERE id=$1",
        [id],
      );
    }));
  it("guards patch submission and review, retaining final decisions", () =>
    transactional(async (client) => {
      const { id, admin } = await fixture(client);
      await constraint(
        client,
        "INSERT INTO patches(report_id,summary,reference,patched_at,submitted_by_id) VALUES ($1,'Valid patch summary','v1',now(),$2)",
        [id, admin],
      );
      await remediate(client, id, admin);
      const p = await patch(client, id, admin);
      await constraint(
        client,
        "UPDATE patches SET review_status='REJECTED',reviewed_by_id=$1,reviewed_at=now() WHERE id=$2",
        [admin, p],
      );
      await client.query(
        "UPDATE patches SET review_status='REJECTED',reviewed_by_id=$1,reviewed_at=now(),review_note='Regression remains' WHERE id=$2",
        [admin, p],
      );
      await constraint(
        client,
        "UPDATE patches SET review_status='APPROVED' WHERE id=$1",
        [p],
      );
      const replacement = await patch(client, id, admin, "v2");
      await approve(client, replacement, admin);
      await close(client, id, admin);
      await constraint(client, "DELETE FROM patches WHERE id=$1", [
        replacement,
      ]);
    }));
  it("enforces payout eligibility, exact amounts, uniqueness, and ledger joins", () =>
    transactional(async (client) => {
      const { id, owner, admin } = await fixture(client);
      const sql =
        "INSERT INTO bounty_payouts(report_id,amount,currency,reference,recorded_by_id) VALUES ($1,$2,$3,$4,$5)";
      await constraint(client, sql, [id, "20.50", "INR", "early", admin]);
      await remediate(client, id, admin);
      await approve(client, await patch(client, id, admin), admin);
      await close(client, id, admin);
      await constraint(client, sql, [id, 0, "INR", "zero", admin]);
      await constraint(client, sql, [id, 10, "EUR", "unsupported", admin]);
      await client.query(sql, [id, "20.50", "INR", "unique-reference", admin]);
      await constraint(
        client,
        sql,
        [id, 30, "INR", "duplicate-report", admin],
        "23505",
      );
      const ledger = (
        await client.query("SELECT * FROM v_payout_ledger WHERE report_id=$1", [
          id,
        ])
      ).rows[0];
      expect(ledger).toMatchObject({
        amount: "20.50",
        researcher_id: owner,
        recorded_by: "Test admin",
        researcher: "Test researcher",
      });
      await constraint(
        client,
        "UPDATE bounty_payouts SET amount=50 WHERE report_id=$1",
        [id],
      );
      expect(
        (
          await client.query(
            "SELECT count(*) FROM audit_logs WHERE action='PAYOUT_RECORDED' AND metadata->>'reportId'=$1",
            [id],
          )
        ).rows[0].count,
      ).toBe("1");
    }));
  it("rolls back approval, status, history and audit together", () =>
    transactional(async (client) => {
      const { id, admin } = await fixture(client);
      await remediate(client, id, admin);
      const p = await patch(client, id, admin);
      await client.query("SAVEPOINT approval");
      await approve(client, p, admin);
      await close(client, id, admin);
      await client.query("ROLLBACK TO SAVEPOINT approval");
      expect(
        (
          await client.query("SELECT review_status FROM patches WHERE id=$1", [
            p,
          ])
        ).rows[0].review_status,
      ).toBe("PENDING");
      expect(
        (
          await client.query(
            "SELECT status FROM vulnerability_reports WHERE id=$1",
            [id],
          )
        ).rows[0].status,
      ).toBe("REMEDIATING");
      expect(
        (
          await client.query(
            "SELECT count(*) FROM audit_logs WHERE action='PATCH_REVIEWED' AND entity_id=$1",
            [p],
          )
        ).rows[0].count,
      ).toBe("0");
      expect(
        (
          await client.query(
            "SELECT count(*) FROM report_status_history WHERE report_id=$1 AND to_status='PATCHED'",
            [id],
          )
        ).rows[0].count,
      ).toBe("0");
    }));
  it("counts multiple patch attempts once and keeps audit records append-only", () =>
    transactional(async (client) => {
      const { id, admin } = await fixture(client);
      await remediate(client, id, admin);
      const before = (
        await client.query(
          "SELECT * FROM v_report_dashboard WHERE status='REMEDIATING' AND severity='MEDIUM'",
        )
      ).rows[0];
      await patch(client, id, admin, "a");
      const p = await patch(client, id, admin, "b");
      await approve(client, p, admin);
      const after = (
        await client.query(
          "SELECT * FROM v_report_dashboard WHERE status='REMEDIATING' AND severity='MEDIUM'",
        )
      ).rows[0];
      expect(after.report_count).toBe(before.report_count);
      expect(
        BigInt(after.patched_report_count) -
          BigInt(before.patched_report_count),
      ).toBe(BigInt(1));
      await constraint(client, "DELETE FROM audit_logs WHERE entity_id=$1", [
        id,
      ]);
    }));
});

// Exercise a genuine upgrade from the teammate's schema in an isolated namespace.
describe.skipIf(!hasPostgres)("migration compatibility", () => {
  it("preserves legacy patch and payout rows", () =>
    transactional(async (client) => {
      const { readFile } = await import("node:fs/promises");
      const { randomUUID } = await import("node:crypto");
      const namespace = `upgrade_${randomUUID().replaceAll("-", "")}`;
      await client.query(`CREATE SCHEMA ${namespace}`);
      await client.query(`SET LOCAL search_path TO ${namespace}, public`);
      await client.query(
        await readFile(
          "prisma/migrations/202610190001_initial_schema/migration.sql",
          "utf8",
        ),
      );
      const { id, admin } = await fixture(client);
      await remediate(client, id, admin);
      const patchId = (
        await client.query(
          "INSERT INTO patches(report_id,summary,reference,patched_at) VALUES ($1,'Legacy verified fix','legacy-v1',now()) RETURNING id",
          [id],
        )
      ).rows[0].id;
      await close(client, id, admin);
      await client.query(
        "INSERT INTO bounty_payouts(report_id,amount,reference,recorded_by_id) VALUES ($1,123.45,'legacy-paid',$2)",
        [id, admin],
      );
      await client.query(
        await readFile(
          "prisma/migrations/202610250001_patch_review_payout_audit/migration.sql",
          "utf8",
        ),
      );
      expect(
        (
          await client.query(
            "SELECT review_status,submitted_by_id FROM patches WHERE id=$1",
            [patchId],
          )
        ).rows[0],
      ).toEqual({ review_status: "PENDING", submitted_by_id: null });
      expect(
        (
          await client.query(
            "SELECT amount,reference FROM bounty_payouts WHERE report_id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ amount: "123.45", reference: "legacy-paid" });
    }));
});
