# AGENTS.md

## Mandatory Instructions

Before making changes, read and follow:

- `docs/standards/common/development-guidelines.md`

Treat it as mandatory repository-wide guidance.

For application-specific changes, also follow the closest applicable `AGENTS.md`:

The repository root is the single application scope. For changes in this scope, read:

- `docs/standards/blog/development.md` — dependency, configuration, build, and publishing rules.
- `docs/standards/blog/coding-style.md` — formatting and code conventions.
- `docs/standards/blog/testing.md` — testing policy and required validation.

## Project Documentation

For dependency, configuration, build, preview, or publishing changes, read [docs/development.md](docs/development.md) for the current implementation and commands. This reference and the standards above are intended for agents.

## Hard Constraints

- Preserve user-authored content unless the task explicitly requires changing it.
- Keep generated output, installed dependencies, local caches, and secrets out of commits.

## Development Documentation

- Do not create new project development documentation unless the current task explicitly requires it.
- Store development documentation under `docs/`.
- Review relevant documentation before development.
- For new features or changes to documented architecture, design, or behavior, update the relevant documentation first, then implement according to it.
- Prefer updating existing documentation over creating duplicate or conflicting documents.
- Keep documentation consistent with the current implementation, concise, and focused on information needed for development and maintenance.
- Write project development documentation in `zh-TW`.
- Keep all `AGENTS.md` files and files under `docs/standards/` in en-US.

## Instruction Precedence

Follow instructions in this order:

1. Explicit task requirements.
2. The closest applicable `AGENTS.md`.
3. This root `AGENTS.md`.
4. Documents referenced by the applicable `AGENTS.md`.
5. Existing implementation patterns that do not conflict with the above.

Scoped `AGENTS.md` files may specialize local rules but must not weaken repository-wide hard constraints.

## Commits

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for all commit messages.

Write commit messages in `zh-TW` while keeping Conventional Commits types and scopes in English.
