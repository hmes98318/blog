# Development

## Scope and authorities

- Treat this repository as one static blog application. Blog posts are content, not project development documentation.
- Use [Hexo documentation](https://hexo.io/docs/) and [Butterfly documentation](https://butterfly.js.org/) for framework behavior. Check the installed versions and upstream migration notes before adopting version-sensitive settings.
- Keep the root [README](../../../README.md) brief. Store descriptive development documentation under `docs/`, outside `docs/standards/`. Keep standards limited to durable normative rules. Both are agent-facing and routed through [AGENTS.md](../../../AGENTS.md).
- Read the [development reference](../../development.md) for dependency roles, configuration ownership, and command descriptions. Read [package.json](../../../package.json), [package-lock.json](../../../package-lock.json), and the owning configuration files as the authorities for dependencies, scripts, runtime requirements, and settings. Do not duplicate version lists or configuration inventories in README or standards.

## Dependencies and runtime

- Use npm as the package manager and commit `package.json` together with `package-lock.json` whenever dependency resolution changes. Use `npm ci` to reproduce the committed dependency tree.
- Follow the Node.js version in `.nvmrc` and the package manager and engine requirements in `package.json`. Coordinate runtime changes with the Docker builder and CI.
- Select stable upstream releases and resolve their configuration and API changes as part of an upgrade. Remove unused dependencies instead of carrying disabled tooling forward.
- Review dependency lifecycle scripts before adding version-specific entries to `package.json`'s `allowScripts`. Revisit those entries when the approved versions change.
- Resolve patched transitive dependencies within compatible ranges. Do not use forced audit fixes that downgrade the blog framework or add unverified cross-major overrides.
- Keep build and lint tools in `devDependencies`; install them in the build environment. The static serving image should contain the generated site rather than Node.js tooling.

## Configuration and assets

- Keep site and plugin configuration in `_config.yml` and theme configuration in `_config.butterfly.yml`.
- Maintain both files from the complete upstream configuration templates for the installed stable versions. Preserve upstream options, commented examples, and explanatory comments when applying site customizations.
- Remove obsolete keys when migrating configuration. Verify that the installed theme consumes the new configuration shape and that enabled blog features still render.
- Keep authored content and custom assets separate from generated theme files. Never edit `node_modules` to customize the theme.
- Keep intentional local assets under `source/` and explicitly connect them through supported theme configuration when needed. Avoid copying upstream scripts into `source/` when the installed theme already supplies the behavior.
- Preserve the site's locale, timezone, authored dates, and existing post `abbrlink` values unless the task explicitly changes them. Verify generated URLs after renderer, generator, theme, or permalink changes.
- Keep unpublished drafts unpublished. Preserve post front matter and the existing content organization when performing tooling maintenance.

## Building and publishing

- Generate and optimize the site through the configured `npm run build` command. Keep local builds, CI, and Docker on that same build path.
- Treat `public/` and `db.json` as generated artifacts. Clean stale output before validating changes that can remove or rename generated files.
- Use the committed Compose configuration for container builds. Keep local dependencies and generated output outside the Docker build context.
- Run publishing operations only when the current task authorizes publishing.
