# Testing and Validation

## Confirmed automated-testing policy

| Surface | Dedicated automated tests |
| --- | --- |
| Local browser interactions and custom assets | Not required |
| Build tasks, generation, and configuration integration | Not required |

These surfaces have no standing obligation to add or update dedicated automated tests. Do not introduce a testing framework or a coverage target solely to satisfy a general testing default. Existing configured checks must still run, and focused tests may be added when a task warrants them.

## Required validation

- Run `npm run lint` for changes to JavaScript, lint configuration, or dependencies used by those files.
- Validate dependency changes with `npm ci` and verify that approved dependency lifecycle scripts run successfully.
- Run `npm run clean` followed by `npm run build` for dependency, renderer, generator, theme, build-task, or site-configuration changes. Verify that optimization completes successfully, not just Hexo generation.
- Check representative generated pages and affected assets. For framework or theme upgrades, include a post with code blocks, pagination, archives, categories, tags, the 404 page, and enabled reading controls.
- Verify existing post URLs and authored source content after tooling migrations. Check that enabled feeds, sitemaps, and search indexes remain parseable and contain the expected posts.
- Validate Compose configuration and build the container when Docker configuration changes and a Docker engine is available. Report unavailable validation accurately.
- Review dependency audit findings during upgrades. Distinguish fixes available within compatible releases from unpatched upstream issues; do not weaken checks or downgrade the framework to make an audit appear clean.
