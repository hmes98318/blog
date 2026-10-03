# Coding Style

## Authorities

- The enforced `eslint.config.mjs` is the JavaScript style authority. Follow [ESLint flat configuration](https://eslint.org/docs/latest/use/configure/) and [ESLint Stylistic](https://eslint.style/) when maintaining it.
- Follow official Hexo and Butterfly guidance for framework-specific usage. Preserve the repository's existing Markdown front-matter conventions for blog content.

## JavaScript and configuration

- Use two-space indentation, single-quoted JavaScript strings, and no statement semicolons or trailing commas, as enforced by the linter.
- Prefer `const`; use `let` when reassignment is necessary. Declare Node.js and browser globals only in their relevant file scopes.
- Keep browser scripts independent of Node.js APIs. Keep build tasks out of browser assets and use the module format selected by the owning configuration.
- Fix lint errors directly. Do not add broad rule suppressions or writable globals to hide errors.
- Use consistent two-space indentation in YAML. Preserve upstream option comments and examples in configuration templates. Keep project-added comments focused on intentional overrides, upgrade requirements, or non-obvious decisions.
- Write concise Markdown without fixed-column prose wrapping. Preserve fenced code blocks and front matter when editing articles.
