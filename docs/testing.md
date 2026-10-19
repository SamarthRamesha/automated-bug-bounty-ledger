# Testing

Run `npm run build`, `npm run db:generate`, `npm run db:seed`, and `npm test`.

The PostgreSQL integration test uses a real local database. Each test transaction is rolled back, proving constraints without retaining test rows. It verifies automatic status history, valid and invalid status transitions, positive payout enforcement, and duplicate-payout prevention. MongoDB tests are Rahul's phase.
