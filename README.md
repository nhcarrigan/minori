# Minori - Dependency Update Manager

Minori is an automated dependency management system for Gitea repositories. It checks all repositories in your organisation for outdated npm dependencies and creates pull requests with changelogs for each update.

## Features

- 🔍 Scans all repositories in a Gitea organisation
- 📦 Checks npm dependencies for updates
- 📝 Fetches changelogs from GitHub releases when available
- 🔄 Creates individual PRs for each dependency update
- ⏰ Runs on a configurable schedule or one-time
- 🌸 Adds a friendly signature to each PR

## Prerequisites

- Node.js v20 or higher
- pnpm package manager
- A Gitea instance with API access
- 1Password CLI (for secret management)

## Installation

1. Clone the repository:
```bash
git clone https://git.nhcarrigan.com/nhcarrigan/minori.git
cd minori
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the project:
```bash
pnpm build
```

## Configuration

Minori uses the `prod.env` file for secrets management with 1Password vault references:

```bash
# Gitea Authentication
GITEA_TOKEN=op://Personal/Gitea Personal Access Token/credential
```

Other configuration values are set in `src/config.ts`:
- `GITEA_URL`: https://git.nhcarrigan.com
- `GITEA_ORG`: nhcarrigan
- `CHECK_INTERVAL`: 0 7 * * * (daily at 7am)
- `PR_BRANCH_PREFIX`: dependencies/update-

### Required Permissions

Your Gitea personal access token needs the following permissions:
- Read access to repositories
- Write access to create branches
- Write access to create pull requests
- Write access to push commits

## Usage

### Run Once (Testing)

To run a single dependency check without scheduling:

```bash
RUN_ONCE=true op run --env-file=prod.env -- node prod/index.js
```

Note: `RUN_ONCE` is a runtime flag, not a configuration value

### Run as Service

To run continuously on a schedule:

```bash
op run --env-file=prod.env -- node prod/index.js
```

### Systemd Service (Production)

Create a systemd service file at `/etc/systemd/system/minori.service`:

```ini
[Unit]
Description=Minori Dependency Update Manager
After=network.target

[Service]
Type=simple
User=naomi
WorkingDirectory=/path/to/minori
ExecStart=/usr/bin/op run --env-file=prod.env -- /usr/bin/node prod/index.js
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable minori
sudo systemctl start minori
```

## How It Works

1. **Repository Discovery**: Minori fetches all repositories from your Gitea organisation
2. **Package Analysis**: For each repository with a `package.json`, it checks all dependencies
3. **Version Comparison**: Compares current versions with latest npm releases
4. **PR Creation**: For each outdated dependency:
   - Creates a new branch
   - Updates the version in `package.json`
   - Fetches changelog information
   - Creates a pull request with details
5. **Deduplication**: Skips creating PRs if one already exists for that dependency

## Development

```bash
# Install dependencies
pnpm install

# Run linting
pnpm lint

# Build the project
pnpm build

# Run tests
pnpm test
```

## Scripts

- `pnpm lint` - Run ESLint
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Run the built application with 1Password
- `pnpm test` - Run tests (placeholder)

## License

See LICENSE.md

## Credits

Created with 💖 by Naomi Carrigan

✨ Minori was built with help from Hikari~ 🌸