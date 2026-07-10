# Contributor Guide

Welcome to Neuron OS development! Follow these guide conventions.

## Code Conventions

- **Next.js 16**: Use pure React Server Actions (`"use server"`) for mutate operations.
- **Tailwind & CSS**: Do not inject custom utility properties if shadcn or global class values suffice. Keep page layout responsive.
- **Centralized Types**: All reusable interfaces must go inside `src/types/` and be exported through `src/types/index.ts`.
- **Constants**: Extract magic values like XP rewards or database limits to `src/constants/`.

## Workflow

1. Fork/Branch from `main` branch.
2. Build local changes and verify with `npm run build`.
3. Open a pull request targeting `main`.
