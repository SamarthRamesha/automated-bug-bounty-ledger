# Comprehensive Viva & Demonstration Guide
## Automated Bug Bounty Vulnerability Patch & Payout Ledger
**Course:** DBMS Experiential Learning — Level 3 Project  
**Team Members:**
- **Samarth Ramesha** (`mail.samarth.r@gmail.com`) — Foundation, Relational Architecture, Authentication, Base APIs & UI
- **Rahul B** (`PES2UG24CS393`, `rahulbiju512@gmail.com`) — Advanced Triggers/Integrity, Patch Review Workflow, Payout Ledger, MongoDB Evidence & Aggregation, E2E Testing

---

## 1. Team Responsibilities & Presentation Split

To satisfy **Requirement 2** and **Requirement 15** (Individual Contributions), divide your viva presentation cleanly:

```
+---------------------------------------------------------------------------------------+
|                                    DEMO WORKFLOW                                      |
+-------------------------------------------+-------------------------------------------+
|             SAMARTH RAMESHA               |                  RAHUL B                  |
+-------------------------------------------+-------------------------------------------+
| 1. System Architecture & Relational Design| 1. Advanced SQL Triggers & State Guards   |
| 2. User Roles, JWT Sessions & Auth (RBAC) | 2. Patch Review & Transactional Approval  |
| 3. Vulnerability Submission & Lifecycle   | 3. Payout Ledger & Immutability Rules     |
| 4. Base Relational Schema & Migrations    | 4. MongoDB Evidence & Aggregation Pipeline|
| 5. Important SQL Queries (DDL/DML/Search) | 5. Concurrency Race Testing & E2E Verif.  |
+-------------------------------------------+-------------------------------------------+
```

---

## 2. Pre-Demo Setup Checklist (2 Minutes Before Faculty Arrives)

Run these checks in two separate terminal tabs before calling the examiner:

### Terminal 1: Application Server
```bash
# 1. Ensure databases and environment variables are active
cp -n .env.example .env
# Make sure .env has your actual database connection strings and passwords

# 2. Run Prisma migration & seed demo accounts
npx prisma migrate deploy
npm run demo:seed

# 3. Start Next.js development server
npm run dev
# App will run at http://localhost:3000
```

### Terminal 2: Database Terminals Ready
```bash
# Export connection strings for immediate SQL and MongoDB inspection
export DATABASE_URL="postgresql://postgres:password@localhost:5432/bug_bounty_ledger"
export MONGODB_URI="mongodb://127.0.0.1:27017/bug_bounty_ledger"

# Test psql connection
psql "$DATABASE_URL" -c "SELECT count(*) FROM vulnerability_reports;"
```

---

## 3. The 10-Minute Live Demo Script (Step-by-Step)

### Phase 1: High-Level Overview & Architecture (Presented by Samarth) — 1.5 Mins
- **What to say:**
  > "Respected Professor, our project is the **Automated Bug Bounty Vulnerability Patch & Payout Ledger**. It solves a mission-critical cybersecurity problem: tracking software vulnerabilities from initial researcher submission, through triage and remediation patch review, to cryptographic audit logging and conditional bounty payment.
  > Instead of a simple CRUD app, we implemented a dual-database architecture:
  > 1. **PostgreSQL** handles identity, strict relational state transitions, patch review integrity, exact decimal financial ledgering, and immutable audit logs.
  > 2. **MongoDB** handles unstructured reproduction evidence, arbitrary technical metadata, and component aggregation.
  > We have two distinct roles: **Researcher** and **Admin**."
- **Visual:** Open `docs/diagrams/er-diagram.md` or show the ER diagram on screen.

---

### Phase 2: Researcher Workflow & Evidence Submission (Presented by Samarth) — 2 Mins
1. Open browser at `http://localhost:3000/login`.
2. Sign in as the primary researcher:
   - **Email:** `researcher.demo@ledger.local`
   - **Password:** `<your SEED_DEMO_PASSWORD>`
3. **Show Researcher Dashboard:**
   - Notice the table only displays reports submitted by this researcher.
   - Point out: *“No admin lifecycle controls, audit logs, or system aggregation metrics are visible to the researcher.”*
4. **Submit a New Vulnerability Report:**
   - **Title:** `SQL Injection in User Search Filter`
   - **Description:** `Unsanitized user input passed directly to database query causing blind boolean extraction.`
   - **Affected Asset:** `https://api.ledger.local/v1/search`
   - **Severity:** `HIGH`
   - Click **Submit report**.
5. **Add Reproduction Evidence (MongoDB Integration):**
   - Click into the newly created report detail page.
   - Click **Add sanitized evidence**.
   - **Reproduction steps:**
     ```
     1. Send GET request to /api/search?q=' OR 1=1--
     2. Observe full table dump in response
     ```
   - **Expected Behavior:** `Input should be parameterized and reject SQL metacharacters.`
   - **Observed Behavior:** `Full table data leaked.`
   - **Affected Components:** `search-service, sql-gateway`
   - Click **Save evidence**.
   - Point out: *“Notice how MongoDB stores arbitrary key-value technical metadata and string arrays without altering our strict relational PostgreSQL tables.”*

---

### Phase 3: Role Isolation & Authorization Check (Presented by Samarth) — 1 Min
1. Open a private/incognito window (or second browser).
2. Sign in as the second researcher:
   - **Email:** `researcher.second@ledger.local`
   - **Password:** `<your SEED_DEMO_PASSWORD>`
3. **Show Isolation:**
   - Point out: *“Researcher 2 sees only their own reports. The report submitted by Researcher 1 is completely invisible.”*
4. **Demonstrate API Guard:**
   - If you paste the URL of Researcher 1's report into Researcher 2's browser, it returns a clean **404 Not Found**, preventing IDOR (Insecure Direct Object Reference).

---

### Phase 4: Admin Triage, Patch Review & ACID Approval (Presented by Rahul) — 2.5 Mins
1. Sign in as the Administrator:
   - **Email:** `admin.demo@ledger.local`
   - **Password:** `<your SEED_DEMO_PASSWORD>`
2. **Show Admin Dashboard:**
   - The admin dashboard displays:
     - Real-time aggregation metric cards from the SQL view `v_report_dashboard`.
     - Component distribution from the MongoDB aggregation pipeline (`search-service`, `sql-gateway`).
     - Global Payout Ledger from `v_payout_ledger`.
3. **Open the Newly Submitted Report:**
   - Click the report `SQL Injection in User Search Filter`.
4. **Triage Lifecycle Transitions:**
   - Advance status: Click **UNDER REVIEW** -> status changes to `UNDER_REVIEW`.
   - Advance status: Click **ACCEPTED** -> status changes to `ACCEPTED`.
   - Advance status: Click **REMEDIATING** -> status changes to `REMEDIATING`.
   - Explain: *“Each status change is guarded by a PostgreSQL trigger `validate_report_status_transition`. If anyone attempts to skip straight to CLOSED, PostgreSQL raises exception code 23514.”*
5. **Patch Management & Rejection:**
   - In the Patch section, submit an initial patch:
     - **Summary:** `Escaped single quotes using regex replacement`
     - **Reference:** `git:commit:a1b2c3d`
     - **Patch date:** Select current/past date.
     - Click **Submit patch**. The patch enters `PENDING` review status.
   - Now reject it:
     - Click **Reject patch**.
     - Review note: `Regex escaping is insufficient; use prepared statements.`
     - Submit rejection.
     - Explain: *“The database retains rejected patches for compliance history; they cannot be edited or deleted.”*
6. **Submit Replacement Patch & Approve:**
   - Submit replacement patch:
     - **Summary:** `Replaced raw query with parameterized Prisma query`
     - **Reference:** `git:commit:e5f6g7h`
     - Click **Submit patch**.
   - Click **Approve patch**.
   - **Crucial Teaching Point:**
     > *“Notice that upon approving the patch, the report status instantaneously changed to `PATCHED`! This was executed in an ACID transaction with a PostgreSQL row lock (`SELECT FOR UPDATE`). The patch approval and the report status transition are strictly atomic—one cannot succeed without the other.”*

---

### Phase 5: Closure, Payout Ledger & Immutability (Presented by Rahul) — 2 Mins
1. **Advance Report to CLOSED:**
   - Click **CLOSED**. The report is now closed.
2. **Record Bounty Payment:**
   - Scroll to **Record Bounty Payout**.
   - **Amount:** `75000.00`
   - **Currency:** `INR`
   - **Payment Reference:** `UPI-HDFC-20261031-9843`
   - Click **Record payout**.
   - Explain:
     > *“The payout has been recorded in `bounty_payouts`. Key integrity rules enforced here:
     > 1. Exact decimal numeric precision (`NUMERIC(12,2)`); floating-point rounding errors are impossible.
     > 2. One payout per report (`UNIQUE(report_id)`).
     > 3. Payout write guard trigger enforces that payouts can ONLY be inserted for CLOSED reports with an APPROVED patch.
     > 4. Recipient is derived directly from report ownership—an admin cannot redirect money to another account.
     > 5. The ledger is immutable; UPDATE and DELETE queries are blocked by triggers.”*
3. **Show Audit Trail & Status History:**
   - Scroll down to view the **Status History Timeline** and **Audit Log Trail**.
   - Show how every single action (`REPORT_SUBMITTED`, `REPORT_STATUS_CHANGED`, `PATCH_SUBMITTED`, `PATCH_REVIEWED`, `PAYOUT_RECORDED`) is logged with timestamps, actor IDs, and JSONB metadata.

---

### Phase 6: Code & Terminal SQL/NoSQL Verification (Both) — 1 Mins
Switch to Terminal 2 to run direct SQL and NoSQL queries to show the faculty the underlying database engine.

---

## 4. Live Terminal Demonstrations (Commands Faculty Love to See)

### Demo A: Important SQL Queries (`important-queries.sql`)
Run the prepared SQL script to demonstrate joins, aggregates, HAVING, views, and full-text search:

```bash
# Execute the important queries script
psql "$DATABASE_URL" -v search_term=Injection -v report_id=$(psql "$DATABASE_URL" -t -A -c "SELECT id FROM vulnerability_reports LIMIT 1;") -f database/queries/important-queries.sql
```

**Explain each query output to the faculty:**
1. **Full-Text Search (GIN Index):** Searches `title` and `description` using `to_tsvector('english', ...) @@ plainto_tsquery(...)`.
2. **GROUP BY + HAVING:** Aggregates reports by severity and filters out categories using `HAVING COUNT(*) >= 1`.
3. **JOIN + Subquery (`NOT EXISTS`):** Finds all CLOSED reports that have no bounty payout yet.
4. **SQL Dashboard View (`v_report_dashboard`):** Demonstrates conditional aggregation using `COUNT(*) FILTER (WHERE EXISTS (...))`.
5. **SQL Payout Ledger View (`v_payout_ledger`):** Multi-table join across `bounty_payouts`, `vulnerability_reports`, recording admin `users`, and researcher `users`.

---

### Demo B: Temporary DDL & DML Script (`ddl-demonstration.sql`)
Proves Requirement 5 (CREATE, ALTER, DROP, INSERT, UPDATE, DELETE):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/queries/ddl-demonstration.sql
```
Explain: *“This script executes inside a transaction that creates a temporary table, alters it to add a timestamp column, inserts records, updates validated records, deletes unvalidated drafts, queries the result, drops the table, and rolls back safely without modifying production data.”*

---

### Demo C: MongoDB Aggregation Pipeline Live in mongosh
Proves Requirement 7 (Advanced NoSQL aggregation):

```bash
mongosh "$MONGODB_URI" --eval '
db.report_evidence.aggregate([
  { $unwind: "$affectedComponents" },
  { $group: { _id: "$affectedComponents", evidenceCount: { $sum: 1 } } },
  { $sort: { evidenceCount: -1, _id: 1 } },
  { $project: { _id: 0, component: "$_id", evidenceCount: 1 } }
]);
'
```
Explain: *“Here is our multi-stage MongoDB aggregation pipeline. It takes documents with arrays of affected components, unpacks them with `$unwind`, groups and counts occurrences with `$group` using `$sum: 1`, sorts by frequency, and projects clean output for our admin dashboard.”*

---

### Demo D: Testing PostgreSQL Triggers Direct Rejection (Direct SQL Test)
Show the faculty what happens if someone bypasses the UI and attempts an illegal SQL insert:

```bash
# 1. Attempt to insert a payout with negative amount (CHECK constraint fails)
psql "$DATABASE_URL" -c "INSERT INTO bounty_payouts (report_id, amount, currency, reference, recorded_by_id) VALUES ('$(psql "$DATABASE_URL" -t -A -c "SELECT id FROM vulnerability_reports LIMIT 1;")', -500, 'INR', 'BAD-REF', '$(psql "$DATABASE_URL" -t -A -c "SELECT id FROM users LIMIT 1;")');"
# Result: ERROR: new row for relation "bounty_payouts" violates check constraint "payout_positive_amount"

# 2. Attempt to delete from audit_logs (Append-only Trigger fails)
psql "$DATABASE_URL" -c "DELETE FROM audit_logs;"
# Result: ERROR: Audit records are append-only (Error 23514)
```

---

## 5. Faculty Q&A Defense (Tough Questions & Exact Answers)

### Q1: Why did you choose a dual-database architecture (PostgreSQL + MongoDB)? Why not store everything in PostgreSQL using JSONB?
> **Answer:**  
> "That was an explicit architectural design decision based on access patterns and data semantics:
> 1. **PostgreSQL** provides ACID transactions, relational integrity, row-level locking, and foreign keys. This is mandatory for user roles, report lifecycle state machines, and financial bounty payouts where lost updates or data corruption cannot be tolerated.
> 2. **MongoDB** is dedicated to reproduction evidence. Bug bounty evidence is inherently unstructured: researchers submit varying reproduction steps, arbitrary browser/OS headers, and dynamic component tags. MongoDB provides flexible document schema validation (`$jsonSchema`), multikey indexing on component arrays, and high-performance aggregation pipelines (`$unwind`, `$group`) without polluting our normalized relational tables.
> 3. By separating concerns, an evidence ingestion spike or schema variation in MongoDB never compromises the core transactional ledger in PostgreSQL."

---

### Q2: How do you handle consistency between PostgreSQL and MongoDB without distributed two-phase commit (2PC)?
> **Answer:**  
> "We implement an **Intent-and-Replay cross-database protocol** with client idempotency:
> 1. When evidence is submitted, PostgreSQL first checks authorization and records an audit intent.
> 2. Next, the evidence is upserted into MongoDB using a client-supplied UUID idempotency key (`_id`).
> 3. Upon MongoDB success, a completion event is logged in PostgreSQL.
> 4. If MongoDB fails, PostgreSQL records a failure and returns a retryable 503.
> 5. If the client retries with the same idempotency key, we compute a SHA-256 payload hash to verify it is identical and return the saved evidence without duplicating audit records.
> This guarantees eventual consistency and prevents phantom duplicates without the overhead of heavy distributed transactions."

---

### Q3: How do you prevent race conditions, such as two admins simultaneously approving a patch or double-paying a bounty?
> **Answer:**  
> "We enforce serialization at two layers:
> 1. **Application Layer:** We use Prisma interactive transactions with PostgreSQL row-level locks:
>    ```sql
>    SELECT * FROM vulnerability_reports WHERE id = $1 FOR UPDATE;
>    ```
>    This forces competing requests on the same report to serialize.
> 2. **Database Layer:**
>    - The `bounty_payouts` table has a `UNIQUE (report_id)` constraint, mathematically preventing more than one payout per report.
>    - The `payout_write_guard` trigger verifies that the report is `CLOSED` and has an `APPROVED` patch before allowing the insert.
>    - In our Playwright E2E tests (`tests/e2e/workflow.spec.ts`), we deliberately race concurrent approval and payout requests: exactly one request wins (200 OK) and the other fails with `409 Conflict`."

---

### Q4: Walk us through your advanced SQL features. Where are the 4 required concepts?
> **Answer:**  
> "We implemented all 4 required advanced SQL concepts:
> 1. **ACID Transactions & Row Locking:** Atomic patch approval and report state advancement inside `prisma.$transaction` using `FOR UPDATE` row locking.
> 2. **Stored Procedures / Functions & Triggers:** Seven distinct triggers:
>    - `validate_report_status_transition`: Enforces the report state machine.
>    - `guard_patch_write`: Enforces that patches can only be submitted in `REMEDIATING` state.
>    - `require_approved_patch`: Prevents advancing to `PATCHED` or `CLOSED` without an approved patch.
>    - `guard_payout_write`: Enforces closure and approved patch before payout.
>    - `record_report_status_history`: Automatically writes to status history.
>    - `audit_workflow_event`: Automatically logs all sensitive operations into `audit_logs`.
>    - `retain_audit_event`: Aborts any UPDATE or DELETE on `audit_logs` (append-only ledger).
> 3. **Indexing:**
>    - Composite B-Tree indexes: `(reporter_id, status)`, `(status, severity, created_at DESC)`, and `(report_id, changed_at DESC)`.
>    - GIN Full-Text Search index: `USING GIN (to_tsvector('english', title || ' ' || description))`.
> 4. **Views:**
>    - `v_report_dashboard`: Complex aggregation view with `COUNT(*)` and conditional `COUNT(*) FILTER (WHERE EXISTS (...))`.
>    - `v_payout_ledger`: Multi-table relational join view linking payouts, reports, recording admins, and receiving researchers."

---

### Q5: What advanced NoSQL concept did you implement?
> **Answer:**  
> "We implemented the **MongoDB Aggregation Pipeline**:
> In `src/lib/evidence.ts`, the `componentSummary()` function runs an aggregation pipeline:
> - `$match`: Scopes evidence documents to authorized report UUIDs.
> - `$unwind`: Unpacks the `affectedComponents` array into individual documents.
> - `$group`: Groups by component name and computes `evidenceCount: { $sum: 1 }`.
> - `$sort`: Sorts by frequency descending, then component name alphabetically.
> - `$project`: Reshapes the output into clean JSON objects.
> In addition, we enforce **Native JSON Schema Validation** (`$jsonSchema` via `collMod`) directly inside MongoDB so invalid documents are rejected at the database engine level."

---

### Q6: Why did you not implement Vector Database / Semantic Search?
> **Answer:**  
> "The project guidelines state that Vector Database is *'Option 2: SQL + Vector Database'* or *'Optional but Recommended'*.
> We selected **Option 1: SQL + NoSQL (MongoDB)**, which satisfies the core 2-paradigm requirement.
> For our problem domain, vulnerability reports require exact keyword indexing, CWE taxonomy matching, and component bucketing. Full-text search with PostgreSQL's GIN index and MongoDB's component aggregation are mathematically deterministic and faster for bug tracking than approximate nearest neighbor (ANN) vector embeddings."

---

### Q7: Show us how your database prevents direct unauthorized SQL updates.
> **Answer:**  
> "Even if an attacker gains raw SQL access through `psql` or SQL injection:
> 1. If they try `UPDATE vulnerability_reports SET status = 'CLOSED' WHERE status = 'SUBMITTED';`, the trigger `validate_report_status_transition` fires and raises error `23514: Invalid report status transition`.
> 2. If they try `INSERT INTO bounty_payouts ...` for a report that hasn't been closed, trigger `guard_payout_write` aborts with `23514: Payout requires a closed report with an approved patch`.
> 3. If they try `DELETE FROM audit_logs;`, trigger `retain_audit_event` aborts with `23514: Audit records are append-only`.
> Our business rules reside in the database engine itself, not just the JavaScript application."

---

## 6. Emergency Troubleshooting Cheat Sheet

| Issue During Demo | Immediate Fix |
|---|---|
| Port 3000 already in use | `npx kill-port 3000` or `npm run dev -- -p 3001` |
| PostgreSQL connection refused | Check `.env` `DATABASE_URL` credentials; ensure local Postgres service is running (`sudo systemctl start postgresql`) |
| MongoDB connection refused | Check `.env` `MONGODB_URI`; ensure MongoDB service is running (`sudo systemctl start mongod`) |
| Seed accounts not logging in | Run `npm run demo:seed` with `SEED_DEMO_PASSWORD` exported in `.env` |
| Demo data messed up | Re-run `npx prisma migrate reset --force` followed by `npm run demo:seed` |

---
*End of Viva & Demonstration Guide. Keep this open during your presentation!*
