# Neuron OS Testing Guide

This directory contains the automated test suites for Neuron OS.

## Directory Structure

- `tests/unit/`: Pure function and isolated unit tests (e.g. AI utilities, gamification algorithms).
- `tests/integration/`: Integration tests covering Supabase connectivity, server actions, and flow validations.
- `tests/e2e/`: End-to-end integration tests using Playwright/Cypress for UI verification.

## Running Tests

To run the test suites, configure your testing framework (e.g. Vitest/Jest and Playwright) and execute:

```bash
npm run test
```
