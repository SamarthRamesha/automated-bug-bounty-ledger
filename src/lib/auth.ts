
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE_NAME = "bb_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const sessionSecret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "",
);

const sessionSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.enum(["RESEARCHER", "ADMIN"])).min(1),
});

export type Session = z.infer<typeof sessionSchema>;

export async function createSession(data: Session) {
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }

  const session = sessionSchema.parse(data);
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret);

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  if (sessionSecret.length < 32) return null;

  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, sessionSecret, {
      algorithms: ["HS256"],
    });

    const parsed = sessionSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export function isAdmin(session: Session): boolean {
  return session.roles.includes("ADMIN");
}
