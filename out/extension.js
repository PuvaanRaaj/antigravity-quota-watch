"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
let myStatusBarItem;
let pollIntervalId;
function activate(context) {
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
    const intervalSeconds = config.get('pollInterval', 120);
    // Initial update
    updateQuota();
    // Set new interval (convert to ms)
    pollIntervalId = setInterval(() => updateQuota(), intervalSeconds * 1000);
}
function deactivate() {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
    }
}
async function updateQuota(manual = false) {
    const config = vscode.workspace.getConfiguration('antigravity');
    const endpoint = config.get('endpoint', 'http://localhost:9222/v1/status');
    const lowThreshold = config.get('lowQuotaThreshold', 20);
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
        }
        else {
            myStatusBarItem.backgroundColor = undefined;
        }
        if (manual) {
            vscode.window.showInformationMessage(`Quota refreshed: ${percentage}% remaining.`);
        }
        myStatusBarItem.show();
    }
    catch (e) {
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
async function fetchQuota(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json());
}
//# sourceMappingURL=extension.js.map