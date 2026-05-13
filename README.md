# Deployment Blocker

A GitHub-only bot that blocks PRs when integration tests fail against a live staging environment.

## Features

- **Webhook-driven**: Listens for GitHub PR events (opened, synchronize, reopened)
- **Test orchestration**: Runs configurable test commands against staging
- **Decision audit trail**: JSONL-based audit log of all block/allow decisions
- **Manual override**: API endpoint to override automated decisions with reason
- **Slack notifications**: Optional notifications to Slack on block events
- **No external dependencies**: Ships with Node + Express, no database required for MVP

## Deployment

### Docker
