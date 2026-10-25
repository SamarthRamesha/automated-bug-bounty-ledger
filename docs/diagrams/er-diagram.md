# ER diagram

```mermaid
erDiagram
  USERS ||--o{ USER_ROLES : receives
  ROLES ||--o{ USER_ROLES : assigns
  USERS ||--o{ VULNERABILITY_REPORTS : submits
  USERS o|--o{ VULNERABILITY_REPORTS : triages
  VULNERABILITY_REPORTS ||--o{ REPORT_STATUS_HISTORY : records
  USERS o|--o{ REPORT_STATUS_HISTORY : changes
  VULNERABILITY_REPORTS ||--o{ PATCHES : has
  VULNERABILITY_REPORTS ||--o| BOUNTY_PAYOUTS : receives
  USERS ||--o{ BOUNTY_PAYOUTS : records
  USERS o|--o{ AUDIT_LOGS : acts
```

MongoDB's `report_evidence` collection is intentionally not shown as a relational entity. It references the PostgreSQL report UUID but has no cross-database foreign key.

Patch actor relationships added by the completion migration:

```mermaid
erDiagram
  USERS o|--o{ PATCHES : submits
  USERS o|--o{ PATCHES : reviews
```

Both actor keys reference `users.id`. Submission attribution is nullable only for
legacy patches; reviewed patches require a reviewer and review timestamp.
