# Flow Context Capability Token — Battle Plan

> Design-phase validation artifact for the signed flow-context / capability-token idea discussed in Issue #1 (#28J/#28K). This document defines what to test before the pattern is promoted from candidate to architectural standard.

## 1. Intent

Dawat has two related pieces of execution context:

- **Session ID** — identifies a continuous customer interaction/context.
- **Correlation ID** — identifies one specific flow/action execution within that session.

A single session may contain many flows and therefore many correlation IDs:

```text
Session S1
├── Greeting flow       → Correlation C1
├── Menu flow           → Correlation C2
├── Cart flow           → Correlation C3
├── Order flow          → Correlation C4
├── Payment flow        → Correlation C5
├── Tracking flow       → Correlation C6
└── Enquiry/update      → Correlation C7+

Session S2
└── New flows → new correlation IDs
```

The proposed token would cryptographically bind important execution context so that every participating service can detect context substitution, mismatch, replay, or confused-deputy behavior.

The token is **not** intended to replace:

- authentication;
- service-to-service identity/mTLS;
- receiver-side authorization/policy evaluation;
- state/workflow validation;
- event idempotency;
- audit/event history.

It is an **integrity and scoped-capability mechanism around an already authenticated and authorized execution context**.

## 2. Candidate model

Conceptually:

```text
Authenticated identity
        ↓
Authorization / Policy
        ↓
Issue or narrow flow context
        ↓
Signed Flow Context Token
        ↓
Service A → Service B → Service C
        ↓
Validate token + authenticated caller + local policy + state
        ↓
Proceed / reject / alert
```

A candidate token may bind:

- subject / actor
- tenant
- branch/resource scope
- session ID
- correlation ID
- flow type / flow instance
- target resource where applicable
- capability/scope
- audience
- issuer/key identifier
- issued-at
- expiry
- nonce/jti or equivalent replay identifier
- delegation/actor provenance where delegation exists
- relevant state/version or execution epoch when needed

The exact token format is intentionally **not selected** by this document.

## 3. Security invariants to test

### Identity integrity

A receiver must detect if the authenticated identity differs from the token subject/actor where the design requires them to match.

### Tenant integrity

A token issued for Restaurant A must not be usable to operate on Restaurant B.

### Branch/resource integrity

Where a capability is branch/resource scoped, changing the branch/resource must fail.

### Session integrity

A flow context from Session S1 must not silently become part of Session S2 where session binding is required.

### Correlation integrity

A token issued for Correlation C1 must not be accepted as Correlation C2.

A new flow normally gets a new correlation ID while retaining the session ID.

### Flow integrity

A token issued for one flow must not authorize an unrelated flow merely because the same identity and tenant match.

### Audience integrity

A token intended for Service B must not be accepted as authorization for Service C unless explicitly designed for that audience.

### Capability integrity

A child/narrowed token must never gain authority beyond the parent authorization.

### Expiry/freshness

Expired or otherwise stale flow context must fail safely.

### Replay resistance

A captured token must not enable unauthorized repeated execution where replay protection is required.

### Delegation integrity

If A delegates to B, the receiver must be able to distinguish the original subject from the acting service/actor and enforce the delegated scope.

### State integrity

A valid token must not bypass normal state/workflow transition rules.

### Provider independence

The token model must not encode Meta-specific semantics that would make replacing Meta materially harder.

## 4. Threat model / adversarial test matrix

| Test | Attack / fault | Expected result |
|---|---|---|
| T01 | Change subject A → B | Reject + security signal |
| T02 | Change tenant A → B | Reject + security signal |
| T03 | Change branch | Reject if branch-bound |
| T04 | Change resource/order ID | Reject if resource-bound |
| T05 | Change session ID | Reject if session-bound |
| T06 | Change correlation ID | Reject |
| T07 | Change flow type | Reject |
| T08 | Re-sign/modify token without key | Reject |
| T09 | Use valid token at wrong audience | Reject |
| T10 | Use expired token | Reject |
| T11 | Replay valid token | Reject when operation is replay-sensitive |
| T12 | Reuse token after capability revocation | Reject within defined revocation bound |
| T13 | Ask for broader child scope than parent | Refuse narrowing/issuance |
| T14 | Call privileged operation not represented by capability | Reject |
| T15 | Valid token + invalid domain state | Reject through workflow/state machinery |
| T16 | Valid token + unauthorized current actor | Reject |
| T17 | Cross-service token forwarding to unintended service | Reject through audience/scope validation |
| T18 | Concurrent use of same token | Behave according to explicitly defined concurrency semantics; no privilege escalation |
| T19 | Out-of-order event with valid token | Domain transition rules reject/handle safely |
| T20 | Retry/replay through recovery path | Re-enter normal authorization/state machinery |
| T21 | Correlation mismatch with otherwise valid request | Reject and create actionable security telemetry |
| T22 | Session remains same but new correlation is legitimate | Accept only with newly issued/valid flow context |
| T23 | WhatsApp provider changes | Core token semantics remain unchanged |
| T24 | Token accidentally contains PII/secrets | Fail design review; remove/minimize sensitive data |

## 5. Test the distributed execution model

The battle must not stop at unit tests. Test a complete flow across synchronous and asynchronous boundaries.

Example:

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

Verify that:

1. the same session + correlation context survives every intended hop;
2. event metadata retains correlation/causation correctly;
3. asynchronous consumers cannot accidentally substitute context;
4. provider callbacks are mapped into a new trusted integration context rather than blindly trusting customer-originated context;
5. retries, DLQ replay and reconciliation cannot bypass validation;
6. an invalid context is visible to operations without exposing secrets/PII.

## 6. Compare candidate approaches

The battle should compare at least these families:

1. **Signed JWT-style flow context**
2. **PASETO-style signed/local tokens**
3. **OAuth 2.0 Token Exchange / delegated scoped tokens**
4. **Capability-oriented tokens with explicit audience/resource/scope**
5. **No additional flow token** — rely on authenticated service identity + correlation/session metadata + authorization/state checks

The winner is not automatically the most sophisticated mechanism.

We should prefer the **simplest mechanism that provides the required integrity and security properties without duplicating standard authorization machinery**.

## 7. Success criteria

The candidate becomes an architectural standard only if all of the following are satisfied.

### Security

- **100% rejection** of intentional subject/tenant/branch/resource/correlation/flow substitution in the test suite.
- No privilege escalation through token narrowing, forwarding or delegation.
- Replay behavior is explicitly defined and passes the required replay tests.
- Expiry/revocation behavior meets the defined security bound.
- Wrong-audience use is rejected.
- Token forgery/tampering is rejected.
- A valid token never bypasses authorization or state-transition checks.

### Correctness

- Session ID remains stable across flows within a session.
- Correlation ID changes for each distinct flow/action execution as defined by the flow model.
- All synchronous and asynchronous participants preserve the correct context.
- Correlation/causation/event identity remain distinct and correct.
- Retries, replay and reconciliation preserve context without creating accidental authority.

### Operational safety

- Invalid-context failures produce actionable security/operational signals.
- Alerts can distinguish security/integrity violations from ordinary 4xx business outcomes and infrastructure failures.
- Token validation does not create an unacceptable availability dependency.
- Key rotation and failure/recovery procedures are demonstrated.
- The system remains diagnosable through Session → Correlation → Trace → Event → Service relationships.

### Privacy

- No unnecessary PII or secrets are embedded in tokens.
- Token contents are safe to handle according to their classification.
- Logs/traces never expose signing secrets or sensitive token material.

### Portability

- Core domain models contain no Meta/provider-specific token semantics.
- Replacing Meta/payment/delivery providers does not require redesigning the flow-context model.
- Provider adapters can create/translate trusted integration context at the boundary.

### Complexity

The mechanism must justify its operational and development complexity. If ordinary authenticated service identity + authorization + workflow validation already provides equivalent protection for a given boundary, the token must not be added merely for architectural elegance.

## 8. Failure classification

A failed token/context check is not automatically the same as an ordinary client error.

```text
Context validation
       ↓
 ┌─────┼───────────────┐
 │     │               │
Expected invalid   Suspicious mismatch   Infrastructure failure
 │                 │                     │
Controlled 4xx     Security signal       5xx/availability handling
```

The exact classification should be determined by the receiver and failure policy. Unexpected internal failures remain engineering defects; the system should target zero unhandled 5xx.

## 9. Decision gate

After the battle, choose exactly one outcome:

### A — Adopt
The flow-context/capability token becomes a platform security pattern with documented contract and implementation rules.

### B — Adopt selectively
Use it only for boundaries where cryptographic flow binding materially improves security, delegation or confused-deputy protection.

### C — Reject
Standard authenticated service identity + authorization + workflow/state validation provides sufficient protection and the additional token complexity is not justified.

**Default expectation:** B is acceptable if the evidence shows the mechanism is valuable only at selected trust boundaries. We should not force it onto every internal call merely because it exists.

## 10. Exit criteria before moving on

We can move to the next architectural problem when:

- the threat/test matrix has been executed;
- candidate approaches have been compared;
- security/correctness/operational/privacy/portability criteria have a clear result;
- one of A/B/C is selected;
- the selected pattern is recorded in Issue #1;
- any rejected assumptions are documented;
- no unresolved question materially affects the next architecture decision.

Until then, this remains a **candidate pattern**, not a mandatory platform dependency.
