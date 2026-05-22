# Forge SDLC Team Design

Prompt: Enhance Forge with traditional SDLC team agents and human sign-off gates.

## Intent

Forge `/new` should run a role-based SDLC journey instead of the previous compact phase chain. Forge `/work` should run the same journey against an existing target project so teams can iterate on change requests without recreating the app.

## Agent Flow

```text
BA requirements -> technical architecture -> UI/UX design -> architecture synthesis
-> stories -> development -> QA/testing -> local infrastructure -> review
```

## Sign-off Gates

- BA requirements require Business Analyst approval.
- Architecture synthesis requires Architect approval.
- QA/testing requires QA or Automation Tester approval.
- Local infrastructure requires Infrastructure Owner approval.
- Approvers can approve, request changes, or abort.
- Change requests rerun the producing phase with reviewer guidance for up to three revision cycles.

## Defaults

- Mermaid markdown is the default diagram format for ERD, flow, and class/component diagrams.
- Infra is local-first: use .NET Aspire for suitable .NET distributed apps, otherwise Docker Compose for multi-service local validation.
- Iteration mode defaults to `./forge-out`, writes or updates `docs/CHANGE_REQUEST.md`, and scopes implementation to the requested change.
- Cloud provisioning and external GitHub/Azure DevOps approval integrations are deferred.
