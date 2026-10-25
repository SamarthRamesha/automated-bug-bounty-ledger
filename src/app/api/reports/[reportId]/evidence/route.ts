import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { completionId, evidenceCollection, evidenceSchema, payloadHash } from "@/lib/evidence";
import { reportIdSchema } from "@/lib/validation";
import { ApiError, authenticated, body, endpoint, parse, reportId, visibleReport, type ReportContext } from "@/lib/workflow";
export async function GET(_request: Request, context: ReportContext) {
  return endpoint(async () => {
    const session = await authenticated();
    const id = await reportId(context);
    await visibleReport(id, session);
    try { return await (await evidenceCollection()).find({ reportId: id }).sort({ createdAt: -1 }).toArray(); }
    catch { throw new ApiError(503, "EVIDENCE_UNAVAILABLE", "Evidence storage is unavailable. Try again shortly."); }
  });
}
export async function POST(request: Request, context: ReportContext) {
  return endpoint(async () => {
    const session = await authenticated();
    const id = await reportId(context);
    await visibleReport(id, session);
    const input = await body(request, evidenceSchema);
    const operationId = parse(reportIdSchema, request.headers.get("Idempotency-Key") ?? randomUUID());
    const hash = payloadHash(input);
    try {
      await prisma.auditLog.create({ data: { id: operationId, actorId: session.userId, action: "EVIDENCE_REQUESTED", entityType: "REPORT_EVIDENCE", entityId: operationId, metadata: { reportId: id, payloadHash: hash } } });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const intent = await prisma.auditLog.findUnique({ where: { id: operationId } });
      const metadata = intent?.metadata as { reportId?: string; payloadHash?: string };
      if (intent?.action !== "EVIDENCE_REQUESTED" || intent.actorId !== session.userId || metadata?.reportId !== id || metadata?.payloadHash !== hash) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Use a new idempotency key for different evidence.");
    }
    let evidence;
    try {
      const collection = await evidenceCollection();
      const now = new Date();
      await collection.updateOne({ _id: operationId }, { $setOnInsert: { ...input, reportId: id, submittedByUserId: session.userId, createdAt: now, updatedAt: now } }, { upsert: true });
      evidence = await collection.findOne({ _id: operationId });
    } catch {
      await prisma.auditLog.create({ data: { actorId: session.userId, action: "EVIDENCE_WRITE_FAILED", entityType: "REPORT_EVIDENCE", entityId: operationId, metadata: { reportId: id } } }).catch(() => undefined);
      throw new ApiError(503, "EVIDENCE_UNAVAILABLE", "Evidence storage is unavailable. Retry with the same idempotency key.");
    }
    let auditPending = false;
    try {
      await prisma.auditLog.create({ data: { id: completionId(operationId), actorId: session.userId, action: "EVIDENCE_SAVED", entityType: "REPORT_EVIDENCE", entityId: operationId, metadata: { reportId: id } } });
    } catch (error) { if ((error as { code?: string }).code !== "P2002") auditPending = true; }
    return { ...evidence, auditPending };
  }, 201);
}
