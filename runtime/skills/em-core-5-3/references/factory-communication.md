# EM Factory and knowledge communication

EM agents are functional collaborators implemented here through Skills. EM Installer owns INSTALL; EM Factory is the App and executable resource/interaction tooling, not a replacement agent or a second orchestrator. Core keeps routing, continuity, integration and gates; Structurer keeps problem formulation, reformulation and representation.

## Resources throughout problem solving

Identify reusable capabilities and missing resources at any stage, not only after solving the problem. The rightful agent authors domain-specific content; Installer designs and assembles code, documents, data, tests, configurations or interfaces through EM Factory or other available tools. Safe reversible construction can proceed within the assignment without declaring the problem solved. Record content, purpose, owner, dependencies, criteria, evidence and unmet capabilities. Do not turn unavailable tools into claimed execution. EM Factory does not invoke an independent model, execute supplied code, register plugins or deploy servers.

- `factory_status`: inspect implemented capabilities and limits.
- `factory_open`: review a `workspace`, a plugin `spec`, or a `communication` object; visual opening is optional.
- `factory_build_resources`: bundle authored text resources in a workspace with `name`, `problem`, `outcome`, `stage`, `resources`, `missingCapabilities`. Stages: understand, analyze, decide, act, install, learn. Each resource has `path`, `kind` (document/code/data/test/interface/configuration), `content`, `purpose`, `owner` (EM Core/Structurer/Descriptor/Predictor/Prescriptor/Actioner/Installer/Publisher), `acceptance`, `evidence`. Safe relative paths only. Reports distinguish structural preparation from tested behavior and installation.
- `factory_present_context`: present knowledge for correction and understanding. Supply `title`, `problem`, `stage`, `owner`, `question`, `predicates`, `alternatives`, `assumptions`. Predicate: `id`, `language`, `expression`, `interpretation`, `evidence`; optional `value` in [0,1] and `curve` with `variable`, `unit`, `provenance`, strictly increasing `{x,mu}` points. Alternative: `id`, `label`, `reason`, `conditions`. The semantic object remains usable in dialogue without a visual host.
- `factory_build_plugin`: only when Eureka-0 requests a new plugin related to the solved problem. Supply `spec` plus `pluginRequest` with `requestedBy: "Eureka-0"`, the actual `request` and `solutionEvidence`. Do not fabricate consent/evidence or infer this request from generic resource construction. Evidence remains supplied, not independently verified by the factory. Spec includes name/displayName/description/author/problem/outcome/acceptance/skills/mcp/resources. Additional resources belong in references/, scripts/, assets/. Materialize the returned ZIP, then use authorized Plugin Creator and appropriate deployment tools. Prefer updating an existing plugin when appropriate; preserve identity and audience.

## Communication as cognition

Continue rich, concise dialogue under PC-2.1. Offer a view only when it helps Eureka-0 understand, correct, compare or decide; never make opening a dashboard mandatory. Composition follows meaning, stage and recipient, not a fixed data dashboard. Prefer one productive semantic object over numerous charts. The view is an optional communication instrument, not an authority or evidence source. A user correction, question or preference returns through Core to the rightful agent and its work product. A selected alternative alone is not execution authorization. Keep traceability from view to problem, agent, assumptions, evidence and meaning.

## CUT language and interpretability

Use adjectives, adverbs, verbs and nouns with relevant connectives to expose knowledge and generate meaningful predicates. Include “if and only if” / “si y solo si” and equivalent expressions when they assert biconditional meaning: P iff Q (P ↔ Q), with both directions stated and checked. Distinguish a proposed definition from an empirically established equivalence; do not infer reverse implication from P → Q. Preserve quantification, domain, modifiers, uncertainty and exceptions. Do not change accepted meaning silently.

Use Concept ↔ Language ↔ Predicate ↔ Logical/Mathematical Representation ↔ Visualization when explanatory value warrants it. Give knowledge, meaning and relationships greater weight than raw data decoration. Show membership/GCLV interpretation, linguistic modifiers, generator/operator provenance and semantic anchors when available, simply and with progressive disclosure. A truth degree is not a probability. Never relabel generic weighted scoring, arbitrary triangular curves or point interpolation as ACFL/GCLV. Use validated supplied definitions/operators/calibration; when absent, show the semantic predicate and mark numerical evaluation pending. Factory curves plot supplied points with linear interpolation for inspection only; no ACFL aggregation or GCLV calibration is performed.

## Access

Preserve the current private audience. Site OAuth and verified request identity protect tool calls; this release adds no public distribution, external-user entitlement service or global revocation of installed Skills. External distribution and admission control require their own verified implementation and tests.
