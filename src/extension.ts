// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GardenProvider, GroupBy, HealthFilter } from './gardenProvider';
import { GardenStatusBar } from './gardenStatusBar';


export function activate(context: vscode.ExtensionContext) {
  const provider = new GardenProvider(context);
  const statusBar = new GardenStatusBar();
  
  // Register tree data provider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('verdantView', provider),
    // Register dispose method to clean up watchers
    { dispose: () => provider.dispose() },
    statusBar
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('verdantview.refresh', () => {
      provider.refresh();
      vscode.window.showInformationMessage('Verdant Garden refreshed! 🌱');
    }),

    vscode.commands.registerCommand('verdantview.analyzeFile', async (item) => {
      if (item && item.uri && item.metrics) {
        const metrics = item.metrics;
        const message = `📊 **File Analysis: ${item.label}**\n\n` +
          `Lines: ${metrics.lines.toLocaleString()}\n` +
          `Size: ${Math.round(metrics.size/1024)}KB\n` +
          `Complexity: ${metrics.complexity}\n` +
          `Type: ${metrics.type}\n` +
          `Health: ${metrics.health}\n` +
          `Last Modified: ${metrics.lastModified.toLocaleDateString()}\n\n` +
          (metrics.issues.length > 0 ? `Issues:\n${metrics.issues.map((i: string) => `• ${i}`).join('\n')}` : 'No issues found! ✨');
        
        vscode.window.showInformationMessage(message);
      }
    }),

    vscode.commands.registerCommand('verdantview.showMetrics', async (item) => {
      if (item && item.uri && item.metrics) {
        const panel = vscode.window.createWebviewPanel(
          'verdantMetrics',
          `Metrics: ${item.label}`,
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        
        panel.webview.html = createMetricsWebview(item.metrics, item.label, item.uri.fsPath);
      }
    }),

    vscode.commands.registerCommand('verdantview.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'verdantView');
    }),

    vscode.commands.registerCommand('verdantview.exportReport', async () => {
      try {
        await provider.exportReport();
        vscode.window.showInformationMessage('Garden report exported! 📄');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export report: ${error}`);
      }
    }),

    vscode.commands.registerCommand('verdantview.filterByHealth', async () => {
      const options: vscode.QuickPickItem[] = [
        { label: 'All Files', description: 'Show all files regardless of health' },
        { label: 'Healthy Files', description: 'Show only healthy files 🌱' },
        { label: 'Files Needing Attention', description: 'Show files with warnings ⚠️' },
        { label: 'Critical Files', description: 'Show only critical files 🚨' }
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Filter files by health status'
      });

      if (selected) {
        let filter: HealthFilter;
        switch (selected.label) {
          case 'Healthy Files': filter = 'healthy'; break;
          case 'Files Needing Attention': filter = 'warning'; break;
          case 'Critical Files': filter = 'critical'; break;
          default: filter = 'all'; break;
        }
        provider.setHealthFilter(filter);
        vscode.window.showInformationMessage(`Filtering by: ${selected.label}`);
      }
    }),

    vscode.commands.registerCommand('verdantview.groupByType', async () => {
      const options: vscode.QuickPickItem[] = [
        { label: 'No Grouping', description: 'Show all files in a flat list' },
        { label: 'Group by File Type', description: 'Group files by their type (TypeScript, Python, etc.)' },
        { label: 'Group by Health', description: 'Group files by health status' },
        { label: 'Group by Folder', description: 'Group files by their containing folder' }
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Choose grouping method'
      });

      if (selected) {
        let groupBy: GroupBy;
        switch (selected.label) {
          case 'Group by File Type': groupBy = 'type'; break;
          case 'Group by Health': groupBy = 'health'; break;
          case 'Group by Folder': groupBy = 'folder'; break;
          default: groupBy = 'none'; break;
        }
        provider.setGroupBy(groupBy);
        vscode.window.showInformationMessage(`Grouping by: ${selected.label}`);
      }
    }),

    vscode.commands.registerCommand('verdantview.toggleFileWatching', async () => {
      const config = vscode.workspace.getConfiguration('verdantView');
      const currentSetting = config.get<boolean>('enableFileWatching', true);
      
      await config.update('enableFileWatching', !currentSetting, vscode.ConfigurationTarget.Workspace);
      
      const status = !currentSetting ? 'enabled' : 'disabled';
      const icon = !currentSetting ? '👁️' : '🚫';
      vscode.window.showInformationMessage(`${icon} File watching ${status}`);
      
      // Refresh to apply the change
      provider.refresh();
    }),

    vscode.commands.registerCommand('verdantview.showGardenSummary', async () => {
      const summary = await provider.getGardenSummary();
      const message = `🌱 **Garden Health Summary**\n\n` +
        `📊 Total Files: ${summary.total}\n` +
        `🌱 Healthy: ${summary.healthy} (${Math.round(summary.healthy/summary.total*100)}%)\n` +
        `⚠️ Warning: ${summary.warning} (${Math.round(summary.warning/summary.total*100)}%)\n` +
        `🚨 Critical: ${summary.critical} (${Math.round(summary.critical/summary.total*100)}%)\n\n` +
        `Overall Health: ${Math.round(summary.healthy/summary.total*100)}%`;
      
      vscode.window.showInformationMessage(message);
    }),

    vscode.commands.registerCommand('verdantview.updateStatusBar', (summary: any) => {
      statusBar.updateStatus(summary.total, summary.healthy, summary.warning, summary.critical);
    })
  );

  // Welcome message with file watching status
  const config = vscode.workspace.getConfiguration('verdantView');
  const fileWatchingEnabled = config.get<boolean>('enableFileWatching', true);
  const watchIcon = fileWatchingEnabled ? '👁️' : '🚫';
  
  vscode.window.showInformationMessage(
    `🌱 Welcome to Verdant Garden! ${watchIcon} File watching ${fileWatchingEnabled ? 'enabled' : 'disabled'}`
  );
}

function createMetricsWebview(metrics: any, fileName: string, filePath: string): string {
  const healthColor = metrics.health === 'healthy' ? '#4CAF50' : 
                     metrics.health === 'warning' ? '#FF9800' : '#F44336';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Metrics</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .file-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .file-path {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 16px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .health-indicator {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            color: white;
            font-weight: bold;
            background-color: ${healthColor};
        }
        .issues {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 16px;
        }
        .issues h3 {
            margin-top: 0;
        }
        .issue-item {
            margin: 8px 0;
            padding: 8px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="file-name">📊 ${fileName}</div>
        <div class="file-path">${filePath}</div>
    </div>
    
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-value">${metrics.lines.toLocaleString()}</div>
            <div class="metric-label">Lines of Code</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value">${Math.round(metrics.size/1024)}KB</div>
            <div class="metric-label">File Size</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value">${metrics.complexity}</div>
            <div class="metric-label">Complexity Score</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value"><span class="health-indicator">${metrics.health.toUpperCase()}</span></div>
            <div class="metric-label">Health Status</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value">${metrics.type}</div>
            <div class="metric-label">File Type</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value">${metrics.lastModified.toLocaleDateString()}</div>
            <div class="metric-label">Last Modified</div>
        </div>
    </div>
    
    ${metrics.issues.length > 0 ? `
    <div class="issues">
        <h3>🚨 Issues Detected</h3>
        ${metrics.issues.map((issue: string) => `<div class="issue-item">• ${issue}</div>`).join('')}
    </div>
    ` : `
    <div class="issues">
        <h3>✨ No Issues Found</h3>
        <p>This file appears to be in good health!</p>
    </div>
    `}
</body>
</html>`;
}


// This method is called when your extension is deactivated
export function deactivate() {}
