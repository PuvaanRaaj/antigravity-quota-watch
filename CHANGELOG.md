# Change Log

All notable changes to the "antigravity-quota-watch" extension will be documented in this file.

## [1.0.0] - First Major Release

- **Official Release**: Polished UI, stable auto-discovery, and identity update.
- **UI**: Visual progress bars, specific reset times, and smart color coding.
- **Identity**: Published by Puvaan Raaj with new dark theme branding.

## [0.0.14]

- UI: Removed technical debug details (Port/Token) from tooltip for a cleaner look.
- Feature: Added specific reset times for each model in the tooltip.
- UI: Refined color thresholds (Green/Red) and formatting.

## [0.0.13]

- Identity: Updated author name to "Puvaan Raaj" and refreshed extension icon with a dark theme design.
- UI: Added colorful syntax highlighting (Green/Red) to the status bar tooltip using Markdown diff blocks.

## [0.0.12]

- UI: Added colorful syntax highlighting (Green/Red) to the status bar tooltip using Markdown diff blocks.

## [0.0.11]

- Fix: Fixed build failure due to missing type definitions.
- Feature: Added "Last Updated" and "Next Refresh" time to the status bar tooltip.
- UI Overhaul: Added ASCII progress bars, global token counters, and improved typography.
- Feature: Added support for displaying "Prompt Credits" (used vs. total).

## [0.0.8]

- UI Overhaul: Added ASCII progress bars, global token counters, and improved typography (bold headers) in tooltips and QuickPicks.
- Feature: Added support for displaying "Prompt Credits" (used vs. total) in addition to model percentages.

## [0.0.7]

- Feature: Added `Show Quota Details` command (click status bar item) to view a list of all models and their remaining quota.
- Feature: Detailed status bar tooltip listing all model percentages.

## [0.0.6]

- Fixed protocol error: Switched from HTTP to HTTPS for local server connection (matching reference implementation).
- Added `rejectUnauthorized: false` to support self-signed certificates on localhost.

## [0.0.5]

- Fixed "Status Code: 400" error by correcting the API request payload.
- Enhanced error logging for API connection issues.

## [0.0.4] - 2026-02-01

- Automatic detection of Antigravity port and token (no more manual config needed!)
- Update categories to "Machine Learning" and "Visualization"

## [0.0.3] - 2026-02-01

- Added extension icon

## [0.0.2] - 2026-02-01

- Fixed publishing issues (license/changelog)

## [0.0.1] - 2026-02-01

- Initial release
- Live quota monitoring in status bar
- Low quota warning notifications
- Configurable polling endpoint
