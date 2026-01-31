import * as vscode from 'vscode';
import * as https from 'http'; // using http since localhost usually matches

let myStatusBarItem: vscode.StatusBarItem;
let pollIntervalId: NodeJS.Timeout | undefined;

interface QuotaResponse {
    quota: number;
    reset_in?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Quota Watch is now active!');

    // 1. Register the refresh command
    const refreshCommand = vscode.commands.registerCommand('ag-quota.refresh', () => {
        updateQuota(true);
    });
    context.subscriptions.push(refreshCommand);

    // 2. Create the Status Bar Item (Right side, priority 100)
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'ag-quota.refresh';
    context.subscriptions.push(myStatusBarItem);

    // 3. Handle configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('antigravity')) {
            vscode.window.showInformationMessage('Antigravity Quota Watch configuration changed. reloading...');
            startPolling();
        }
    }));

    // 4. Initial start
    startPolling();
}

function startPolling() {
    // Clear existing interval
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = undefined;
    }

    // Get config
    const config = vscode.workspace.getConfiguration('antigravity');
    const intervalSeconds = config.get<number>('pollInterval', 120);

    // Initial update
    updateQuota();

    // Set new interval (convert to ms)
    pollIntervalId = setInterval(() => updateQuota(), intervalSeconds * 1000);
}

export function deactivate() {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
    }
}

async function updateQuota(manual = false) {
    const config = vscode.workspace.getConfiguration('antigravity');
    const endpoint = config.get<string>('endpoint', 'http://localhost:9222/v1/status');
    const lowThreshold = config.get<number>('lowQuotaThreshold', 20);

    // Show loading state if manual refresh
    if (manual) {
        myStatusBarItem.text = `$(sync~spin) Checking Quota...`;
        myStatusBarItem.show();
    }

    try {
        const data = await fetchQuota(endpoint);
        
        // Assuming data.quota is a float 0.0 - 1.0
        const percentage = Math.round(data.quota * 100);
        
        myStatusBarItem.text = `$(dashboard) Quota: ${percentage}%`;
        myStatusBarItem.tooltip = `Click to refresh.\nReset in: ${data.reset_in || 'unknown'}`;
        
        // Visual warning if low
        if (percentage < lowThreshold) {
            myStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            // Optional: Show a warning notification only if we haven't shown it recently? 
            // For now, let's keep it simple and only notify on manual refresh or significant drop.
        } else {
            myStatusBarItem.backgroundColor = undefined;
        }

        if (manual) {
            vscode.window.showInformationMessage(`Quota refreshed: ${percentage}% remaining.`);
        }
        
        myStatusBarItem.show();
    } catch (e: any) {
        myStatusBarItem.text = `$(error) Quota: Offline`;
        myStatusBarItem.tooltip = `Error connecting to ${endpoint}\n${e.message}`;
        myStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        myStatusBarItem.show();

        if (manual) {
            vscode.window.showErrorMessage(`Failed to fetch quota: ${e.message}`);
        }
    }
}

// Helper to fetch data using standard fetch or http (VS Code has fetch globally in newer versions, 
// strictly speaking we might want to use node-fetch or axios if not targeting web extension, 
// but global fetch is available in Node 18+ which VS Code uses).
// We'll wrap it for basic error handling.
async function fetchQuota(url: string): Promise<QuotaResponse> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as QuotaResponse;
}