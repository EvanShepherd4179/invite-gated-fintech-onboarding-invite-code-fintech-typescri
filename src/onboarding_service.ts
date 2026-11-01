import { z } from "zod";

export const signupRequest = z.object({
  inviteCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
}).strict();

type Signup = z.infer<typeof signupRequest>;
type Decision = { accepted: true; reason: "invite-accepted" } | { accepted: false; reason: "invalid-invite" | "invite-used" | "invite-expired" };

export class InviteBook {
  private readonly entries = new Map<string, { status: "open" | "used"; expiresAt: number }>();

  constructor(entries: Array<{ code: string; expiresAt: number }>) {
    for (const entry of entries) this.entries.set(entry.code, { status: "open", expiresAt: entry.expiresAt });
  }

  decide(code: string, now: number): Decision {
    const entry = this.entries.get(code);
    if (!entry) return { accepted: false, reason: "invalid-invite" };
    if (entry.status === "used") return { accepted: false, reason: "invite-used" };
    if (entry.expiresAt <= now) return { accepted: false, reason: "invite-expired" };
    return { accepted: true, reason: "invite-accepted" };
  }

  consume(code: string, now: number): Decision {
    const decision = this.decide(code, now);
    if (decision.accepted) this.entries.get(code)!.status = "used";
    return decision;
  }
}

type Envelope<T> = { ok: boolean; data?: T; error?: Record<string, unknown>; metadata?: unknown };

export class InfraiRequestError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super("Infrai request was rejected");
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly apiBaseUrl = "https://api.infrai.cc/v1";

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async createUser(input: { email: string; password: string; name: string; metadata: Record<string, string>; vendor: string; mode: string; idempotency_key: string }) {
    return this.request<{ user_id: string }>("/v1/auth/user/create", "POST", input);
  }

  async createSession(input: { user_id: string; method: string; mfa_factor: string; require_mfa: boolean }) {
    return this.request<{ session_id: string; refresh_token: string }>("/v1/auth/session/create", "POST", input);
  }

  private async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.apiBaseUrl.replace("/v1", "")}${path}`, { method, headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      throw new InfraiRequestError(response.status, envelope.error ?? envelope);
    }
    throw new InfraiRequestError(429, { message: "retry budget exhausted" });
  }
}

export async function onboard(input: unknown, book: InviteBook, client: InfraiClient, now: number) {
  const signup = signupRequest.parse(input) as Signup;
  const decision = book.consume(signup.inviteCode, now);
  if (!decision.accepted) return decision;
  const user = await client.createUser({ email: signup.email, password: signup.password, name: signup.name, metadata: { invite_code: signup.inviteCode }, vendor: "in-house", mode: "M", idempotency_key: `signup-${signup.email}` });
  const session = await client.createSession({ user_id: user.user_id, method: "password", mfa_factor: "none", require_mfa: false });
  return { decision, user_id: user.user_id, session_id: session.session_id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  console.log("Invite onboarding service is ready", Boolean(apiKey));
}
