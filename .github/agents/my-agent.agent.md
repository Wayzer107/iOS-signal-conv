# Agent Instructions

## Mandatory Superpowers bootstrap

Before doing any repository work, first ensure that the Superpowers plugin is installed and active for GitHub Copilot CLI.

Superpowers is required for all non-trivial development tasks in this repository. Treat it as part of the repository workflow, not as an optional enhancement.

### Install / verify Superpowers

At the start of a new session, before editing files, planning implementation, debugging, refactoring, or writing tests:

1. Check whether the `copilot` CLI is available.
2. Check whether the Superpowers plugin is already installed.
3. If it is not installed, install it using the official Superpowers Copilot CLI marketplace commands:

```bash
copilot plugin marketplace add obra/superpowers-marketplace
copilot plugin install superpowers@superpowers-marketplace
