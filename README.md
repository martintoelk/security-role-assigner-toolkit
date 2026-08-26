# BU Security Role Assigner

A Power Platform ToolBox (PPTB) tool for safely previewing and assigning Dataverse security roles by business unit. It loads teams, users, roles, business units, and assignments from the active connection; bulk role changes are available for teams.

## Local development

Prerequisites: Node.js 20 or later, npm, and Power Platform ToolBox.

```powershell
npm install
npm run build
npm run dev-watch
```

In PPTB, enable **Show Debug Menu** in Settings. In **Debug**, choose **Load Local Tool**, select this repository root (the folder containing `package.json`), and reload the tool after each rebuild. Use only a sandbox Dataverse environment while developing and testing later role-management features.

### PPTB 1.2.5 compatibility

PPTB 1.2.5 has a host-side path resolution issue when a scoped npm package is loaded without a version suffix. Until the host fix is released, use **Load Local Tool** for development or specify a published package version explicitly, such as `@martintoelk/bu-security-role-assigner@1.0.2`; use `@1.0.3` after this metadata fix is published.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run validate -- --skip-url-checks
```

The GitHub Actions workflow runs the same checks on pushes and pull requests.

## Account and release gates

Before the first public release, a maintainer must complete these human-owned steps:

1. Create and verify the npm account for the `@martintoelk` scope, including email verification and two-factor authentication.
2. Sign in to the PPTB registry/submission service with the publishing account.
3. Make the one-time initial public release manually with `npm publish --access public` after sandbox validation in PPTB.
4. Configure GitHub OIDC trusted publishing for subsequent releases; do not add a long-lived npm publishing token to this repository.

No credentials, tokens, or external Content Security Policy exceptions belong in this repository.

## License

[MIT](LICENSE)
