# Implementation plan and current evidence

## Milestone 1 status

Created: project metadata, environment template, ignore rules, Next.js application shell, architecture, database design draft, API contract, requirements traceability, and team division.

Not yet created: Git repository, installed dependencies, lock file, Prisma schema, migrations, database connections, authentication, APIs, tests, MongoDB module, or final screenshots.

## Planned next milestones

1. Database foundation: tested PostgreSQL schema, migrations, seed data, ER diagram, data dictionary.
2. Core application: Samarth's auth, authorization, report APIs and UI.
3. Advanced database verification: trigger, search/indexes, and tests.
4. Handoff: freeze and document the working Samarth scope.
5. Rahul extension: evidence, patches, payouts, reporting, integrations tests.
6. Final integration: traceability review, actual screenshots, demo guide.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Native services missing | Verify PostgreSQL/MongoDB before database implementation; document installation only if required |
| Current host uses Node 25 | Use Node 24 LTS per `.nvmrc` before dependency install |
| Cross-database partial failure | PostgreSQL remains source of truth; explicit evidence failure/retry handling |
| Scope creep | No payment gateway, payload execution, microservices, or AI features |
