# Publishing `shap-svg` to npm

The repository ships two GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push / PR on `main` | typecheck, tests, build and a dry-run pack on Node 18, 20 and 22 |
| `publish.yml` | push to `main`, or run by hand | publish the version in `package.json` to npm if it is not there yet, then tag `vX.Y.Z` and create a GitHub Release |

## Releasing a new version

1. In a pull request, bump `version` in `package.json` (and `package-lock.json`):

   ```bash
   npm version patch --no-git-tag-version   # or minor / major
   ```

2. Merge the pull request into `main`.

`publish.yml` then publishes that version, tags it and writes the release notes. A merge that does not
change the version does nothing — npm never accepts the same version twice, so the workflow checks
first rather than failing.

`prepublishOnly` runs the typecheck, the tests and the build, so a version that fails any of them is
never uploaded.

## One-time setup: trusted publishing

The workflow authenticates with npm's trusted publishing (OIDC). No npm token is stored in GitHub, and
npm attaches a provenance statement linking each version to the commit and workflow run that built it.

On [npmjs.com](https://www.npmjs.com/), in the `shap-svg` package's **Settings → Trusted publishing**,
add a GitHub Actions publisher with:

| Field | Value |
|---|---|
| Organization or user | `princepongsakorn` |
| Repository | `shap-svg` |
| Workflow filename | `publish.yml` |
| Environment | `npm` |

The workflow filename must match exactly, and `repository.url` in `package.json` must point at this
repository — both are checked by npm.

### The first release

That settings page belongs to a package that already exists on npm, and npm's documentation does not
say whether a trusted publisher can be configured before the first publish. If the page is not
available for a name that has never been published, publish `0.1.0` once by hand, then add the trusted
publisher:

```bash
npm login
npm publish --access public
```

Every later version is published by merging into `main`. If the first automated run happened before
the trusted publisher was configured, re-run it from **Actions → Publish to npm → Run workflow**.

## Local sanity check before bumping

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run   # the tarball should hold dist, README.md, LICENSE and package.json only
```
