# Automated Bug Bounty Vulnerability Patch & Payout Ledger

An original DBMS Level 3 project for recording vulnerability reports, their remediation, sanitized evidence, and an auditable bounty-payout ledger.

## Current milestone

**Milestone 1 - repository foundation.** The application shell and design contracts exist; database-backed workflows are not implemented yet. See [`docs/implementation-plan.md`](docs/implementation-plan.md) for honest status.

## Team

| Member | USN | Phase ownership |
|---|---|---|
| Samarth Ramesha | PES2UG24CS434 | Foundation, PostgreSQL core, authentication, report workflow, handoff |
| Rahul B | PES2UG24CS393 | MongoDB evidence, remediation completion, payouts, reporting, final integration |

## Technology choices

- Next.js, TypeScript, Tailwind CSS (to be added with the application UI)
- PostgreSQL: authoritative relational data
- MongoDB: flexible, sanitized vulnerability-evidence documents
- Prisma: PostgreSQL schema, migrations, and database access
- Official MongoDB Node.js driver: evidence access

Docker is intentionally not required. Run PostgreSQL and MongoDB as native local services.

## Prerequisites

- Node.js 24 LTS and npm 11+
- A native local PostgreSQL instance
- A native local MongoDB instance

The current development host is Node 25.2.1. Prisma's supported release guidance targets LTS Node versions, so use Node 24 before installing dependencies or running the project.

## Initial local setup

Run these from the repository root after Samarth initializes Git:

```bash
nvm use
npm install
cp .env.example .env.local
```

Create the local PostgreSQL database `bug_bounty_ledger`, update `DATABASE_URL` and `SESSION_SECRET` in `.env.local`, then later run the migration commands documented in this README as they are added.

## Git initialization - Samarth

This workspace was intentionally not initialized by the assistant because Samarth requested ownership of the initial setup and commits.

```bash
git init
git add .
git commit -m "chore: initialize project repository"
```

After adding an empty GitHub repository as `origin`:

```bash
git branch -M main
git remote add origin https://github.com/samarthramesha/<repository-name>.git
git push -u origin main
```

Do not run the remote commands until the repository exists and its exact name is known.

## Documentation

- [Requirements traceability](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [ER diagram](docs/diagrams/er-diagram.md)
- [Data dictionary](docs/data-dictionary.md)
- [API contract](docs/api-contract.md)
- [Team contributions](docs/team-contributions.md)
- [Implementation plan](docs/implementation-plan.md)

## Safety boundary

Evidence is restricted to sanitized reproduction notes and metadata. This application must never store exploit payloads, live credentials, malware, or executable proof-of-concept code.
