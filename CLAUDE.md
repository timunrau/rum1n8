# rum1n8 – Claude Instructions

## Testing

Always run **both** test suites after making changes:

```
npm test          # vitest unit tests
npm run test:e2e  # Playwright e2e tests (53 tests, takes ~1-2 min)
```

Never consider testing done until both pass.
