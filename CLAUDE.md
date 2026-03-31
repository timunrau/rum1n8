# rum1n8 – Claude Instructions

## Testing

Always run **both** test suites after making changes:

```
npm test          # vitest unit tests
npm run test:e2e  # Playwright e2e tests (~58 tests, takes ~1-2 min)
```

Never consider testing done until both pass.

When changing or adding functionality, write adequate test coverage for the new behaviour. Only write tests after confirming the user is happy with the implementation — present the changes first, then add tests.

## Git

You have permission to run git commands (commit, pull, etc.) without asking for confirmation first.

Do not push unless explicitly asked. When asked to push, do so without asking for confirmation.
