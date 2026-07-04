---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: superpowers
description: installs superpowers
---

# My Agent

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
