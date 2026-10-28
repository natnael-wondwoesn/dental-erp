# Berhanu live retest — 2026-10-22 11:02 EAT

Target: Berhanu only, deployed image `0.1.6-saas.20261022-auditfix`, running/healthy.
Scope: the four reported findings and their regressions; this is not a complete
new audit of every write workflow.

| Finding                         | Fresh live browser result                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal error boundary           | PASS — `/portal` reaches `/portal/login?clinic=berhanu-dental` and renders the OTP sign-in form. No OTP sent.                                                                                |
| Empty report percentages        | PASS — new and returning patients both show `0.0% of total`, with total patients 0.                                                                                                          |
| Amharic SaaS dashboard          | PASS — module cards, Forms, workspace text, evaluation plan/status and notification controls/empty state translate. English restored afterward.                                              |
| India-specific settings wording | PASS — ETB payment collection guidance, revised setup-guide headings, optional additional tax reference and bank branch/SWIFT labels render. No unsupported Indian gateways offered for ETB. |

Automated rerun: **13 files, 161 tests passed**, zero failures.

## Additional observations

The existing browser tab initially showed recovery/read-only access on the
subscription screen. Fresh navigation showed active access; a subsequent fresh
subscription load also showed **active**, all 20 modules and the original
November 19, 2026 evaluation end. No subscription or database state was changed.
The cause of the initial state was not established in this retest; it should not
be described as a confirmed subscription suspension or as a diagnosed cache bug.
The active trial still shows the existing contact-to-activate guidance, which is
potentially confusing copy but does not change its access status.

No records created/modified, OTP/messages sent, payments made, settings saved,
modules changed, or deployment performed during retest. Authenticated patient
record workflows and actual OTP delivery were not exercised.

Evidence:

- [Fresh Amharic module cards](../../output/berhanu-audit-fixes-20261022/retest-amharic-dashboard.png)
- [Fresh active subscription](../../output/berhanu-audit-fixes-20261022/retest-active-subscription.png)
