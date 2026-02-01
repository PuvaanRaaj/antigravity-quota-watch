# Antigravity Quota Watch

**Antigravity Quota Watch** is a VS Code extension that helps you monitor your Antigravity AI quota directly from your status bar.

## Features

- **Live Quota Monitoring**: See your current quota percentage or token usage at a glance.
- **Visual Progress Bars**: Tooltips and lists now feature ASCII progress bars (e.g., `[████░░░░░░] 40%`) for easy visualization.
- **Global Token Counter**: Track your global Prompt Credits (e.g., `4500 / 5000`).
- **Low Quota Warning**: The status bar item turns red when your quota drops below 20%.
- **Reset Timer**: Hover over the status bar item to see when your quota resets.
- **Detailed View**: Click the status bar item to see a searchable list of all models and their specific quotas.

## Configuration

This extension can be configured via VS Code settings:

- `antigravity.endpoint`: The URL to poll for status (Default: `http://localhost:9222/v1/status`).
- `antigravity.pollInterval`: How often to check for updates in seconds (Default: `120`).
- `antigravity.lowQuotaThreshold`: Percentage threshold valid for warning (Default: `20`).

## Requirements

- You must have the Antigravity local server running (usually on port 9222).

## Release Notes

### 1.1.0

- **Windows Support**: Added platform-specific process discovery for Windows.
- **Cross-Platform**: Now works on macOS, Linux, **and** Windows.

### 1.0.0

- **Official Release**: The first stable release of Antigravity Quota Watch.
- **Monitor with Ease**: Live status bar updates, detailed tooltips, and rapid auto-discovery.
- **Visuals**: ASCII progress bars and color-coded status for at-a-glance monitoring.
- **Identity**: Polished branding with a new dark-theme icon.

> For a full list of changes, please see the [CHANGELOG](CHANGELOG.md).
