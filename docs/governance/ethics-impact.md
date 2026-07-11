# Ethics impact baseline

Status: baseline governance document. This is not a completed DPIA, ethics review or release approval.

## Ethical position

Flux Behaviour must be ethics-led by default.

Its purpose is to improve services, not to judge people. Behavioural signals must be treated as contextual evidence about a service journey, not as a diagnostic label, performance score, risk marker or proxy for protected characteristics.

## Principles

1. Consent first. No telemetry may be captured before explicit opt-in.
2. Minimal data. The product must process interaction metadata only.
3. No content capture. Typed values, free text, passwords and direct identifiers are out of scope.
4. Explainability. Each alert, dimension or interpretation must be traceable to a rule, threshold, model version or reviewer note.
5. Inclusivity. Signals must support both barrier and strength interpretations.
6. Human oversight. High-impact interpretations require human review before product or governance decisions.
7. Service improvement only. Outputs must be used to improve services and support research, not to make eligibility, enforcement or casework decisions.

## Residual risks

### False positives

The product may over-flag normal behaviour as frustration, fatigue, confusion or strain.

Mitigation: use validation evidence, reviewer notes, trend-level interpretation and separate reporting for different user cohorts where ethically and legally appropriate.

Cohort reporting must describe groups of journeys rather than kinds of people. Named cohorts require at least five journeys, smaller groups are suppressed, and the product must not segment by protected characteristics or infer education, intelligence, personality, disability or digital ability. Cohort differences are prompts for service investigation and require a fairness review before broader use.

### Interpretation risk

The same behaviour can have multiple explanations. A long pause may indicate confusion, reading, reflection, interruption, assistive technology use or careful checking.

Mitigation: use dual interpretations, explain uncertainty, and avoid deficit framing.

### Chilling effect

Users may avoid or change behaviour if telemetry is poorly explained.

Mitigation: provide clear consent copy, opt-out control, plain-English purpose statements and limits on data use.

### Misuse risk

Analytics could be used beyond service improvement.

Mitigation: maintain product boundaries, access controls, audit records and governance sign-off before production use.

## Release implication

This baseline supports design and review. It does not authorise live data collection.

Before live use, Flux Behaviour needs DPIA completion, accessibility evidence, security review, operational playbook, incident process, retention policy and a live service assessment decision.
