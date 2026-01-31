
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';

const execAsync = promisify(exec);

let myStatusBarItem: vscode.StatusBarItem;
let pollIntervalId: NodeJS.Timeout | undefined;
let cachedResponse: ServerUserStatusResponse | null = null;

// Minimal interfaces for response parsing
interface QuotaInfo {
    remainingFraction?: number;
    resetTime?: string;
}

interface ClientModelConfig {
    label: string;
    quotaInfo?: QuotaInfo;
}

interface CascadeModelConfigData {
    clientModelConfigs: ClientModelConfig[];
}

interface PlanInfo {
    monthlyPromptCredits: number;
}

interface PlanStatus {
    planInfo: PlanInfo;
    availablePromptCredits: number;
}

interface UserStatus {
    cascadeModelConfigData?: CascadeModelConfigData;
    planStatus?: PlanStatus;
}

interface ServerUserStatusResponse {
    userStatus: UserStatus;
}

interface ProcessInfo {
    pid: number;
    csrfToken: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Quota Watch is now active!');

    // Create Output Channel
    const outputChannel = vscode.window.createOutputChannel("Antigravity Quota");
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Extension activated. Starting auto-discovery...');

    // 1. Register commands
    const refreshCommand = vscode.commands.registerCommand('ag-quota.refresh', () => {
        outputChannel.appendLine('Manual refresh triggered.');
        updateQuota(outputChannel, true);
    });
    context.subscriptions.push(refreshCommand);

    const showDetailsCommand = vscode.commands.registerCommand('ag-quota.showDetails', () => {
        showQuotaDetails(outputChannel);
    });
    context.subscriptions.push(showDetailsCommand);

    // 2. Create Status Bar Item
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'ag-quota.showDetails'; // Click to show details
    context.subscriptions.push(myStatusBarItem);

    // 3. Handle configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('antigravity')) {
            vscode.window.showInformationMessage('Antigravity Quota Watch configuration changed. reloading...');
            startPolling(outputChannel);
        }
    }));

    // 4. Initial start
    startPolling(outputChannel);
}

function startPolling(outputChannel: vscode.OutputChannel) {
    // Clear existing interval
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = undefined;
    }

    // Get config
    const config = vscode.workspace.getConfiguration('antigravity');
    const intervalSeconds = config.get<number>('pollInterval', 120);

    // Initial update
    updateQuota(outputChannel);

    // Set new interval (convert to ms)
    pollIntervalId = setInterval(() => updateQuota(outputChannel), intervalSeconds * 1000);
}

export function deactivate() {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
    }
}

async function findAntigravityProcess(outputChannel: vscode.OutputChannel): Promise<ProcessInfo | null> {
    try {
        // macOS/Linux find process
        const cmd = 'ps -ww -eo pid,args | grep "language_server" | grep -v grep';
        const { stdout } = await execAsync(cmd);
        
        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.includes('--csrf_token') && line.includes('antigravity')) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[0], 10);
                
                const tokenMatch = line.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);
                if (pid && tokenMatch && tokenMatch[1]) {
                    outputChannel.appendLine(`Found Antigravity process: PID=${pid}`);
                    return { pid, csrfToken: tokenMatch[1] };
                }
            }
        }
    } catch (e: any) {
        outputChannel.appendLine(`Error scanning processes: ${e.message}`);
    }
    return null;
}

async function findListeningPort(pid: number, outputChannel: vscode.OutputChannel): Promise<number | null> {
    try {
        // macOS lsof
        const cmd = `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid}`;
        const { stdout } = await execAsync(cmd);
        
        // Output looks like: command pid user fd type device size/off node name ... *:PORT (LISTEN)
        const match = stdout.match(/[*\d.:]+:(\d+)\s+\(LISTEN\)/);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
    } catch (e: any) {
        outputChannel.appendLine(`Error finding port for PID ${pid}: ${e.message}`);
    }
    return null;
}

function getProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

async function showQuotaDetails(outputChannel: vscode.OutputChannel) {
    if (!cachedResponse) {
        vscode.window.showInformationMessage('No quota data available yet. Waiting for connection...');
        updateQuota(outputChannel, true); 
        return;
    }

    const { userStatus } = cachedResponse;
    const configs = userStatus.cascadeModelConfigData?.clientModelConfigs || [];
    const planStatus = userStatus.planStatus;

    const items: vscode.QuickPickItem[] = [];

    // 1. Global Token Credits (if available)
    if (planStatus) {
        const available = planStatus.availablePromptCredits;
        const total = planStatus.planInfo.monthlyPromptCredits;
        const pct = total > 0 ? (available / total) * 100 : 0;
        
        items.push({
            label: `$(circuit-board) Global Token Credits`,
            description: `${getProgressBar(pct, 15)} ${Math.floor(pct)}%`,
            detail: `${available.toLocaleString()} / ${total.toLocaleString()} credits remaining`
        });
        
        items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Models' });
    }

    // 2. Models
    const modelItems = configs
        .filter(m => m.quotaInfo) 
        .map(m => {
            const fraction = m.quotaInfo?.remainingFraction ?? 0;
            const percentage = Math.round(fraction * 100);
            
            let icon = '$(check)';
            if (fraction < 0.2) icon = '$(warning)';
            if (fraction === 0) icon = '$(error)';

            return {
                label: `${icon} ${m.label}`,
                description: `${getProgressBar(percentage, 10)} ${percentage}%`,
                detail: `Reset: ${m.quotaInfo?.resetTime ? new Date(m.quotaInfo.resetTime).toLocaleString() : 'Unknown'}`
            };
        });
        
    if (modelItems.length > 0) {
        items.push(...modelItems);
    } else {
         items.push({ label: 'No specific model quotas found.' });
    }

    vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity Quota Details',
        matchOnDescription: true
    });
}

async function updateQuota(outputChannel: vscode.OutputChannel, manual = false) {
    const config = vscode.workspace.getConfiguration('antigravity');
    const lowThreshold = config.get<number>('lowQuotaThreshold', 20);
    const intervalSeconds = config.get<number>('pollInterval', 120);

    if (manual) {
        myStatusBarItem.text = `$(sync~spin) Checking...`;
        myStatusBarItem.show();
    }

    try {
        // 1. Find Process
        const processInfo = await findAntigravityProcess(outputChannel);
        if (!processInfo) {
            throw new Error('Antigravity process not found. Is the IDE running?');
        }

        // 2. Find Port
        const port = await findListeningPort(processInfo.pid, outputChannel);
        if (!port) {
            throw new Error(`Could not find listening port for PID ${processInfo.pid}`);
        }

        outputChannel.appendLine(`Connected to Antigravity on port ${port} details`);

        // 3. Fetch Data
        const data = await fetchQuota(port, processInfo.csrfToken) as ServerUserStatusResponse;
        cachedResponse = data; // Cache for UI

        outputChannel.appendLine(`API Response received. Parsing quotas...`);

        // Extract Data
        const configs = data.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
        const planStatus = data.userStatus?.planStatus;
        
        // --- Status Bar Text ---
        // Prioritize Global Credits if available, else worst model status
        let statusText = '$(check) Quota OK';
        let barColor = undefined;
        
        if (planStatus) {
            const pct = (planStatus.availablePromptCredits / planStatus.planInfo.monthlyPromptCredits) * 100;
            statusText = `$(circuit-board) ${Math.floor(pct)}%`;
            if (pct < 20) {
                statusText = `$(warning) ${Math.floor(pct)}%`;
                barColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
        } else {
            // Fallback to checking low quota models
            const lowQuotaModels = configs.filter(m => (m.quotaInfo?.remainingFraction ?? 1) < 0.2);
            if (lowQuotaModels.length > 0) {
                 statusText = `$(warning) Quota Low`;
                 barColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
        }
        
        myStatusBarItem.text = statusText;
        myStatusBarItem.backgroundColor = barColor;


        // --- Calculate Timings ---
        const now = new Date();
        const nextRefresh = new Date(now.getTime() + intervalSeconds * 1000);
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nextStr = nextRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // --- Tooltip ---
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        
        tooltip.appendMarkdown(`### 🚀 Antigravity Quota\n\n`);
        
        // Global Credits Section
        if (planStatus) {
             const available = planStatus.availablePromptCredits;
             const total = planStatus.planInfo.monthlyPromptCredits;
             const pct = total > 0 ? (available / total) * 100 : 0;
             const usedPct = 100 - pct;
             
             tooltip.appendMarkdown(`**Global Credits**\n`);
             // Use diff syntax for color: + is Green, - is Red
             tooltip.appendCodeblock(`+ Available: ${available.toLocaleString()} (${Math.floor(pct)}%)\n- Used:      ${Math.floor(usedPct)}%`, 'diff');
             tooltip.appendMarkdown(`\`${getProgressBar(pct, 20)}\`\n\n`);
        }

        // Models Section
        const quotaModels = configs.filter(m => m.quotaInfo);
        if (quotaModels.length > 0) {
            tooltip.appendMarkdown(`**Models**\n`);
            // We can't put the whole list in one block if we want custom links/bolding, 
            // but for color, one big block is best.
            let modelBlock = '';
            quotaModels.forEach(m => {
                const fraction = m.quotaInfo?.remainingFraction ?? 0;
                const pct = Math.round(fraction * 100);
                // Green if > 20%, Red if <= 20%
                const prefix = pct > 20 ? '+ ' : '- ';
                // Pad label for alignment (simple logic)
                const paddedLabel = m.label.padEnd(25, ' ');
                modelBlock += `${prefix}${paddedLabel} [${getProgressBar(pct, 10)}] ${pct}%\n`;
            });
            tooltip.appendCodeblock(modelBlock, 'diff');
        }
        
        // Tech details footer
        tooltip.appendMarkdown(`---\n`);
        tooltip.appendMarkdown(`Last Updated: ${timeStr} | Next Refresh: ~${nextStr}\n`);
        tooltip.appendMarkdown(`$(server) Port: ${port} | $(key) Token: ${processInfo.csrfToken.substring(0,4)}...`);
        
        myStatusBarItem.tooltip = tooltip;
        myStatusBarItem.show();

        if (manual) {
             showQuotaDetails(outputChannel);
        }

    } catch (e: any) {
        outputChannel.appendLine(`Error: ${e.message}`);
        myStatusBarItem.text = `$(error) Offline`;
        myStatusBarItem.tooltip = `Error: ${e.message}`;
        myStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        myStatusBarItem.show();

        if (manual) {
            vscode.window.showErrorMessage(`Failed: ${e.message}`);
        }
    }
}

function fetchQuota(port: number, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
             metadata: {
                ideName: 'antigravity',
                extensionName: 'antigravity',
                locale: 'en',
            },
        });

        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'X-Codeium-Csrf-Token': token,
                'Connect-Protocol-Version': '1'
            },
            rejectUnauthorized: false,
            agent: false,
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                         const bodyPreview = body.length > 200 ? body.substring(0, 200) + '...' : body;
                        reject(new Error(`Invalid JSON response: ${bodyPreview}`));
                    }
                } else {
                     const bodyPreview = body.length > 200 ? body.substring(0, 200) + '...' : body;
                    reject(new Error(`Status Code: ${res.statusCode}, Body: ${bodyPreview}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
             req.destroy();
             reject(new Error('Timeout'));
        });
        
        req.write(payload);
        req.end();
    });
}