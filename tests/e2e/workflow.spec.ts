import "dotenv/config";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
const password = process.env.SEED_DEMO_PASSWORD;
test.skip(!password, "Set SEED_DEMO_PASSWORD and run npm run demo:seed first.");
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function status(page: Page, value: string) {
  await page
    .getByRole("button", { name: value.replaceAll("_", " "), exact: true })
    .click();
  await expect(page.locator(".eyebrow")).toContainText(value);
}
async function addPatch(page: Page, reference: string) {
  await page
    .getByLabel("Patch summary", { exact: true })
    .fill("Fixed the demonstrated input validation regression.");
  await page.getByLabel("Patch/version reference").fill(reference);
  await page.getByLabel("Patch date and time").fill("2026-01-01T12:00");
  await page.getByRole("button", { name: "Submit patch", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${reference} · PENDING`, exact: true }),
  ).toBeVisible();
}
test("researcher → evidence → patch rejection/replacement → closure → payout", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    other = await browser.newContext(),
    admin = await browser.newContext();
  const researcher = await owner.newPage(),
    second = await other.newPage(),
    manager = await admin.newPage();
  const pageErrors: string[] = [];
  for (const page of [researcher, second, manager])
    page.on("pageerror", (error) => pageErrors.push(error.message));
  const title = `Browser demo validation ${randomUUID().slice(0, 8)}`;
  await login(researcher, "researcher.demo@ledger.local");
  await researcher.getByLabel("Report title", { exact: true }).fill(title);
  await researcher
    .getByLabel("Description", { exact: true })
    .fill(
      "A sanitized local demo finding that needs input validation and regression testing.",
    );
  await researcher
    .getByLabel("Affected asset", { exact: true })
    .fill("demo.local/search");
  await researcher
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    researcher.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await researcher.screenshot({
    path: "docs/screenshots/researcher-dashboard.png",
    fullPage: true,
  });
  await researcher.getByRole("link", { name: title, exact: true }).click();
  await expect(researcher).toHaveURL(/dashboard\/reports\/[0-9a-f-]{36}$/);
  const id = researcher.url().split("/").at(-1)!;
  const base = `/api/reports/${id}`;
  await expect(
    researcher.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await researcher.getByText("Add sanitized evidence", { exact: true }).click();
  await researcher
    .getByLabel("Reproduction steps, one per line")
    .fill("Open the local search demo\nObserve validation behavior");
  await researcher
    .getByLabel("Expected behavior")
    .fill("Input is validated consistently.");
  await researcher
    .getByLabel("Observed behavior")
    .fill("A local validation discrepancy appears.");
  await researcher
    .getByLabel("Affected components, comma-separated")
    .fill("search, validation");
  await researcher
    .getByRole("button", { name: "Save evidence", exact: true })
    .click();
  await expect(
    researcher.getByRole("heading", {
      name: "search, validation",
      exact: true,
    }),
  ).toBeVisible();
  await login(second, "researcher.second@ledger.local");
  expect((await other.request.get(base)).status()).toBe(404);
  expect((await other.request.get(`${base}/evidence`)).status()).toBe(404);
  expect(
    (await other.request.post(`${base}/evidence`, { data: {} })).status(),
  ).toBe(404);
  expect((await other.request.get("/api/reports")).ok()).toBeTruthy();
  expect(
    (await (await other.request.get("/api/reports")).json()).data.some(
      (r: { id: string }) => r.id === id,
    ),
  ).toBe(false);
  expect(
    (
      await owner.request.patch(`${base}/status`, {
        data: { status: "UNDER_REVIEW" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await owner.request.post(`${base}/patches`, { data: {} })).status(),
  ).toBe(403);
  expect(
    (await owner.request.post(`${base}/payouts`, { data: {} })).status(),
  ).toBe(403);
  expect((await owner.request.get(`${base}/audit`)).status()).toBe(403);
  await login(manager, "admin.demo@ledger.local");
  expect(
    (
      await admin.request.patch(`${base}/status`, {
        data: { status: "ACCEPTED" },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await admin.request.post(`${base}/payouts`, {
        data: { amount: "25.00", currency: "INR", reference: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  await manager.goto(`/dashboard/reports/${id}`);
  await status(manager, "UNDER_REVIEW");
  await status(manager, "ACCEPTED");
  await status(manager, "REMEDIATING");
  expect(
    (
      await admin.request.patch(`${base}/status`, {
        data: { status: "PATCHED" },
      })
    ).status(),
  ).toBe(409);
  await addPatch(manager, "demo-v1");
  const first = manager.locator("article").filter({
    has: manager.getByRole("heading", {
      name: "demo-v1 · PENDING",
      exact: true,
    }),
  });
  await first
    .getByLabel("Review note (required for rejection)")
    .fill("The regression still reproduces.");
  await first
    .getByRole("button", { name: "Reject patch", exact: true })
    .click();
  await expect(
    manager.getByRole("heading", { name: "demo-v1 · REJECTED", exact: true }),
  ).toBeVisible();
  await addPatch(manager, "demo-v2");
  const replacement = manager.locator("article").filter({
    has: manager.getByRole("heading", {
      name: "demo-v2 · PENDING",
      exact: true,
    }),
  });
  await replacement
    .getByRole("button", { name: "Approve patch", exact: true })
    .click();
  await expect(manager.locator(".eyebrow")).toContainText("PATCHED");
  await status(manager, "CLOSED");
  await manager.getByLabel("Amount", { exact: true }).fill("2500.50");
  await manager
    .getByLabel("Payment reference", { exact: true })
    .fill(`DEMO-${id}`);
  await manager
    .getByRole("button", { name: "Record payout", exact: true })
    .click();
  await expect(
    manager.getByText(`INR 2500.50 · Reference: DEMO-${id}`, { exact: false }),
  ).toBeVisible();
  expect(
    (
      await admin.request.post(`${base}/payouts`, {
        data: { amount: "1", currency: "INR", reference: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const evidenceInput = {
    reproduction: {
      steps: ["Retry local observation"],
      expectedBehavior: "Stable",
      observedBehavior: "Stable",
    },
    affectedComponents: ["retry-test"],
    technicalMetadata: {},
  };
  const key = randomUUID();
  const one = await admin.request.post(`${base}/evidence`, {
    data: evidenceInput,
    headers: { "Idempotency-Key": key },
  });
  const two = await admin.request.post(`${base}/evidence`, {
    data: evidenceInput,
    headers: { "Idempotency-Key": key },
  });
  const canonicalRetry = await admin.request.post(
    `/api/reports/${id.toUpperCase()}/evidence`,
    {
      data: evidenceInput,
      headers: { "Idempotency-Key": key.toUpperCase() },
    },
  );
  expect(canonicalRetry.status()).toBe(201);
  expect((await canonicalRetry.json()).data._id).toBe(key);
  expect(one.status()).toBe(201);
  expect(two.status()).toBe(201);
  expect((await one.json()).data._id).toBe((await two.json()).data._id);
  expect(
    (
      await admin.request.post(`${base}/evidence`, {
        data: { ...evidenceInput, affectedComponents: ["different"] },
        headers: { "Idempotency-Key": key },
      })
    ).status(),
  ).toBe(409);
  const events = (await (await admin.request.get(`${base}/audit`)).json()).data;
  for (const action of [
    "REPORT_SUBMITTED",
    "REPORT_STATUS_CHANGED",
    "PATCH_SUBMITTED",
    "PATCH_REVIEWED",
    "PAYOUT_RECORDED",
    "EVIDENCE_SAVED",
  ])
    expect(
      events.some((event: { action: string }) => event.action === action),
    ).toBe(true);
  expect(
    events.filter(
      (event: { action: string; entityId: string }) =>
        event.action === "EVIDENCE_SAVED" && event.entityId === key,
    ),
  ).toHaveLength(1);
  await manager.reload();
  await expect(
    manager.getByRole("heading", { name: "Audit trail" }),
  ).toBeVisible();
  await expect(
    manager.getByRole("cell", { name: "PAYOUT_RECORDED", exact: true }),
  ).toBeVisible();
  await manager.screenshot({
    path: "docs/screenshots/report-after-payout.png",
    fullPage: true,
  });
  await manager.goto("/dashboard");
  await expect(
    manager.getByRole("cell", { name: `DEMO-${id}`, exact: true }),
  ).toBeVisible();
  await expect(manager.getByText(/^validation: \d+$/)).toBeVisible();
  await manager.screenshot({
    path: "docs/screenshots/admin-dashboard.png",
    fullPage: true,
  });
  await researcher.reload();
  await expect(
    researcher.getByText(`INR 2500.50 · Reference: DEMO-${id}`, {
      exact: false,
    }),
  ).toBeVisible();
  const payouts = (await (await other.request.get("/api/payouts")).json()).data;
  expect(payouts.some((p: { reportId: string }) => p.reportId === id)).toBe(
    false,
  );
  expect(pageErrors).toEqual([]);
  await Promise.all([owner.close(), other.close(), admin.close()]);
});

test("concurrent review and payout requests have a single winner", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  await login(page, "admin.demo@ledger.local");
  const response = await context.request.post("/api/reports", {
    data: {
      title: "Concurrent workflow verification",
      description:
        "A sanitized local finding used to check concurrent administrative actions.",
      affectedAsset: "demo.local",
      severity: "HIGH",
    },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).data.id;
  const base = `/api/reports/${id}`;
  for (const status of ["UNDER_REVIEW", "ACCEPTED", "REMEDIATING"])
    expect(
      (
        await context.request.patch(`${base}/status`, { data: { status } })
      ).status(),
    ).toBe(200);
  const p = await context.request.post(`${base}/patches`, {
    data: {
      summary: "Fixed concurrent validation behavior.",
      reference: "race-v1",
      patchedAt: "2026-01-01T00:00:00Z",
    },
  });
  expect(p.status()).toBe(201);
  const patchId = (await p.json()).data.id;
  const reviews = await Promise.all(
    [1, 2].map(() =>
      context.request.patch(`${base}/patches/${patchId}/review`, {
        data: { decision: "APPROVED" },
      }),
    ),
  );
  expect(reviews.map((r) => r.status()).sort()).toEqual([200, 409]);
  expect(
    (
      await context.request.patch(`${base}/status`, {
        data: { status: "CLOSED" },
      })
    ).status(),
  ).toBe(200);
  const payouts = await Promise.all(
    [1, 2].map((i) =>
      context.request.post(`${base}/payouts`, {
        data: { amount: "20.50", currency: "USD", reference: `${id}-${i}` },
      }),
    ),
  );
  expect(payouts.map((r) => r.status()).sort()).toEqual([201, 409]);
  const events = (await (await context.request.get(`${base}/audit`)).json())
    .data;
  expect(
    events.filter((e: { action: string }) => e.action === "PATCH_REVIEWED"),
  ).toHaveLength(1);
  expect(
    events.filter((e: { action: string }) => e.action === "PAYOUT_RECORDED"),
  ).toHaveLength(1);
  await context.close();
});
