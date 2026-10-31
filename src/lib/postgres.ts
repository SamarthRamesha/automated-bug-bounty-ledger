import { PrismaPg } from "@prisma/adapter-pg";

// The adapter encodes/decodes timestamp values as UTC. Set this for every pooled
// connection so database-default timestamps and JavaScript dates share an instant.
export function createPgAdapter(connectionString: string) {
  return new PrismaPg({ connectionString, options: "-c timezone=UTC" });
}
