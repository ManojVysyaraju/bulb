# Flow Context Capability Token — Battle Plan

> Design-phase validation artifact for the signed flow-context / capability-token idea discussed in Issue #1 (#28J/#28K). This document defines what to test before the pattern is promoted from candidate to architectural standard.

## Intent

Dawat distinguishes **Session ID** (continuous interaction/context) from **Correlation ID** (one specific flow/action execution within that session). A session can contain many flows and therefore many correlation IDs.

The proposed token cryptographically binds execution context so participating services can detect context substitution, mismatch, replay, or confused-deputy behavior.

The token does **not** replace authentication, service identity/mTLS, receiver-side authorization, workflow/state validation, event idempotency, or audit/event history.

## Candidate context

A candidate token may bind:

- subject/actor
- tenant
- branch/resource scope
- session ID
- correlation ID
- flow type/instance
- target resource
- capability/scope
- audience
- issuer/key identifier
- issued-at / expiry
- nonce/jti or equivalent replay identifier
- delegation provenance
- relevant state/version when required

Exact token format is intentionally not selected yet.

## Security invariants

The battle must verify identity, tenant, branch/resource, session, correlation, flow, audience, capability, expiry/freshness, replay, delegation and state integrity. A valid token must never bypass authorization or normal workflow transitions. Provider semantics must remain outside the core token model.

## Threat/adversarial test matrix

| Test | Attack/fault | Expected result |
|---|---|---|
| T01 | Change subject A → B | Reject + security signal |
| T02 | Change tenant A → B | Reject + security signal |
| T03 | Change branch | Reject if branch-bound |
| T04 | Change resource/order ID | Reject if resource-bound |
| T05 | Change session ID | Reject if session-bound |
| T06 | Change correlation ID | Reject |
| T07 | Change flow type | Reject |
| T08 | Modify token without signing key | Reject |
| T09 | Use valid token at wrong audience | Reject |
| T10 | Use expired token | Reject |
| T11 | Replay valid token | Reject when operation is replay-sensitive |
| T12 | Reuse after capability revocation | Reject within defined revocation bound |
| T13 | Request broader child scope | Refuse issuance/narrowing |
| T14 | Invoke privileged operation not represented by capability | Reject |
| T15 | Valid token + invalid domain state | Reject through workflow/state machinery |
| T16 | Valid token + unauthorized current actor | Reject |
| T17 | Forward token to unintended service | Reject via audience/scope |
| T18 | Concurrent use of same token | Follow explicit concurrency semantics; no privilege escalation |
| T19 | Out-of-order event with valid token | Handle/reject via domain transition rules |
| T20 | Retry/replay through recovery | Re-enter normal authorization/state machinery |
| T21 | Correlation mismatch | Reject + actionable security telemetry |
| T22 | Same session, legitimate new flow | Accept only with newly issued/valid flow context |
| T23 | Replace WhatsApp provider | Core token semantics unchanged |
| T24 | Token contains unnecessary PII/secrets | Fail design review; minimize/remove |

## Distributed execution test

Test a complete synchronous + asynchronous flow:

```text
Session S1 / Correlation C4 / Order flow

WhatsApp → BFF → Ordering
                   ↓
                Event Bus
                   ↓
             Payment / Notification / Delivery
                   ↓
                Webhook
                   ↓
              Domain service
```

Verify that session + correlation survive intended hops; event correlation/causation remain correct; async consumers cannot substitute context; provider callbacks create trusted integration context; retry/DLQ/reconciliation cannot bypass validation; invalid context is operationally visible without exposing secrets/PII.

## Candidate approaches

1. Signed JWT-style flow context
2. PASETO-style tokens
3. OAuth 2.0 Token Exchange / delegated scoped tokens
4. Capability-oriented tokens with audience/resource/scope
5. No additional flow token: authenticated service identity + session/correlation metadata + authorization/state checks

Prefer the simplest mechanism that provides the required properties without duplicating standard authorization machinery.

## Success criteria

### Security

- 100% rejection of intentional subject/tenant/branch/resource/correlation/flow substitution.
- No privilege escalation through narrowing, forwarding or delegation.
- Replay, expiry and revocation behavior explicitly defined and passing.
- Wrong audience rejected.
- Forgery/tampering rejected.
- Valid token never bypasses authorization/state transition.

### Correctness

- Session ID stable across flows in one session.
- Correlation ID changes for each distinct flow/action execution.
- All sync/async participants preserve context.
- Correlation, causation and event identity remain distinct.
- Retry/replay/reconciliation cannot create accidental authority.

### Operations

- Invalid-context failures produce actionable signals.
- Security mismatches are distinguishable from ordinary 4xx and infrastructure failures.
- Validation does not introduce an unacceptable availability dependency.
- Key rotation and failure/recovery are demonstrated.
- Session → Correlation → Trace → Event → Service remains diagnosable.

### Privacy/portability

- No unnecessary PII/secrets in tokens.
- No sensitive token material in logs/traces.
- Core domain contains no Meta/provider-specific token semantics.
- Provider replacement does not require redesigning flow context.

### Complexity

The mechanism must justify its complexity. If authenticated service identity + authorization + workflow validation already provides equivalent protection at a boundary, do not add the token merely for architectural elegance.

## Decision gate

**A — Adopt:** platform-wide documented pattern.

**B — Adopt selectively:** only at boundaries where cryptographic flow binding materially improves security/delegation/confused-deputy protection.

**C — Reject:** standard identity + authorization + workflow/state validation is sufficient.

Default expectation: **B is acceptable** if evidence shows value only at selected trust boundaries. Do not force the mechanism onto every internal call.

## Exit criteria

Move on when the threat matrix is executed, candidate approaches are compared, security/correctness/operations/privacy/portability criteria have a clear result, A/B/C is selected and recorded in Issue #1, rejected assumptions are documented, and no unresolved question materially affects the next architecture decision.

Until then this remains a candidate pattern, not a mandatory platform dependency.
