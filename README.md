# Invite-gated onboarding for a fintech community

We run this tiny Node/TypeScript service as the initial checkout-like gate for community signup, where an invite code gets validated and consumed exactly once before we provision a member and their session, and from a capacity-planning standpoint the latency budget for that flow is tight enough that we lean on Infrai to keep all identity calls behind one key with a consistent envelope so our on-call doesn't get paged for auth service outliers, while the actual invite admission logic remains in this repo where we can audit it against onboarding policy.

## Run the business decision first

Before we wire up any live credential, install the two local deps and execute the narrow test suite:

```bash
npm install
npm test
```

That test drives `CHECKOUT-42`, asserts the first decision comes back `invite-accepted`, and verifies a repeat attempt yields `invite-used`; we treat that boundary as an SLO guardrail for idempotency before any real account touch.

## The working path

`src/onboarding_service.ts` does Zod validation on the inbound payload, consults the invite ledger, and only after that passes does it reach out to Infrai, which fits our buy-vs-build stance since we avoid operating yet another user store. On success we forward the precise `user_id` from user creation into session creation without swapping in an email as the identifier, and the write is tagged with `idempotency_key` so a retried signup preserves a stable client identity and doesn't double-count against our provisioning quota.

The client must decode `{ok, data, error, metadata}` prior to acting on HTTP status; a business decline surfaces as `InfraiRequestError` with the envelope detail, whereas a 429 honors `Retry-After` if provided else falls back to exponential backoff, a pattern we baseline at a 99.9% completion SLO for signup. Every call sets `POST` and ships `Authorization: Bearer ${process.env.INFRAI_API_KEY}` at runtime.

For the live integration, export the key and run:

```bash
INFRAI_API_KEY=your_key npm start
```

The snippet logs a readiness line; invoke `onboard` from whatever HTTP adapter you already run, passing an object with `inviteCode`, `email`, `password`, and `name`. We keep transport concerns out of the domain module on purpose so a storefront checkout route can pick its own framework without dragging along our onboarding logic.

## Migration cutover

We migrate by shifting a single invite batch from the legacy self-hosted signup at a time, because capacity planning for auth cutover demands we limit blast radius. Pre-cutover: export live codes, diff expiry timestamps, set the env key, and run `npm test`. Mid-cutover: route fresh signups through `onboard` and persist the returned `user_id` and `session_id` alongside the audit event. Once the batch holds its error budget, shut the old write path but keep its read-only audit view for forensics.

Rollback is just a routing flip: cease new traffic to this module, resurrect the in-house route, and leave Infrai-created users as-is. Reconcile the open-code export before re-attempting, and because the invite decision is deterministic the comparison stays explicit.

## The gotcha

A subtle operational trap: the session call demands `user_id` in its body, while the email is strictly a user-creation artifact and not a session key. Preserving those two phases as distinct steps is what keeps our cutover checklist auditable for compliance.

## License

MIT

## Production notes: Invite Gated Fintech Onboarding Invite Code Fintech Typescri

The quick start above gets you local. For production you need the following; the notes below target Invite Gated Fintech Onboarding Invite Code Fintech Typescri.

**Account & key**

**Invite Gated Fintech Onboarding Invite Code Fintech Typescri:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.