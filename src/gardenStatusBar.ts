import * as vscode from 'vscode';

export class GardenStatusBar {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 
      100
    );
    this.statusBarItem.command = 'verdantview.showGardenSummary';
    this.statusBarItem.show();
  }

  updateStatus(totalFiles: number, healthyCount: number, warningCount: number, criticalCount: number): void {
    const healthPercentage = Math.round((healthyCount / totalFiles) * 100);
    
    let icon: string;
    let color: string;
    
    if (healthPercentage >= 80) {
      icon = '🌱';
      color = '#4CAF50';
    } else if (healthPercentage >= 60) {
      icon = '🌿';
      color = '#FF9800';
    } else {
      icon = '🍂';
      color = '#F44336';
    }
    
    this.statusBarItem.text = `${icon} ${healthPercentage}% Garden Health`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**Garden Health Summary**\n\n` +
      `🌱 Healthy: ${healthyCount} files\n` +
      `⚠️ Warning: ${warningCount} files\n` +
      `🚨 Critical: ${criticalCount} files\n` +
      `📊 Total: ${totalFiles} files\n\n` +
      `Click for detailed summary`
    );
    this.statusBarItem.color = color;
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  show(): void {
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
