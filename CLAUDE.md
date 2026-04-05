# rum1n8 – Claude Instructions

## Testing

You have permission to run tests without asking first. Always run **both** test suites after making changes:

```
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && npm test
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && npx playwright test
```

**Never run tests in the background** (`run_in_background`). They hang or produce no output. Always run them in the foreground with a sufficient timeout (300000ms for e2e).

Never consider testing done until both pass.

When changing or adding functionality, write adequate test coverage for the new behaviour. Only write tests after confirming the user is happy with the implementation — present the changes first, then add tests.

## Git

You have permission to run git commands (commit, pull, etc.) without asking for confirmation first.

Do not push unless explicitly asked. When asked to push, do so without asking for confirmation.
