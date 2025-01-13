# Sponsorship Green Squares

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action fetches the sponsorships of a user or organization and
commits the data to the repository. It helps in tracking and visualizing
sponsorships over time.

## Usage

To use this action, create a workflow file (e.g.,
`.github/workflows/sponsorship.yml`) in your repository with the following
content:

```yaml
name: Fetch Sponsorships and Commit

on:
  schedule:
    - cron: '0 0 * * *' # Runs every day at midnight
  workflow_dispatch:

jobs:
  fetch-and-commit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Fetch Sponsorships and Commit
        uses: santoshyadavdev/sponsorship-green-squares@main
        with:
          allow-add-to-readme: 'false' # Default value, set to 'true' to enable README updates
        env:
          GITHUB_TOKEN: ${{ secrets.PAT_TOKEN }} # do not use GITHUB_TOKEN as it lacks the permission to call graphql APIs, create a new Personal Access TOKEN and provide read:org access to read to sponsorship data
```

### Readme Integration

When `allow-add-to-readme` is set to 'true', the action will update your
README.md with sponsorship data. Add these markers where you want the data to
appear:

```markdown
<!-- SPONSORSHIP-DATA:START -->
<!-- SPONSORSHIP-DATA:END -->
```

The action will automatically insert sponsorship data between these markers in
the format:

- @username-1: 5 USD
- @username-2: 10 USD

### Inputs

1. GH_USERNAME: Your GitHub username (default: ${{ github.repository_owner }})

## Initial Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) handy (20.x or later should work!). If you are
> using a version manager like [`nodenv`](https://github.com/nodenv/nodenv) or
> [`fnm`](https://github.com/Schniz/fnm), this template has a `.node-version`
> file at the root of the repository that can be used to automatically switch to
> the correct version when you `cd` into the repository. Additionally, this
> `.node-version` file is used by GitHub Actions in any `actions/setup-node`
> actions.

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

```bash
 npm test
```

## Update the Action Metadata

The [`action.yml`](action.yml) file defines metadata about your action, such as
input(s) and output(s). For details about this file, see
[Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions).

When you copy this repository, update `action.yml` with the name, description,
inputs, and outputs for your action.
