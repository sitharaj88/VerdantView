import * as vscode from 'vscode';
import * as path from 'path';
import { FileAnalyzer, FileMetrics } from './fileAnalyzer';

export type GroupBy = 'none' | 'type' | 'health' | 'folder';
export type HealthFilter = 'all' | 'healthy' | 'warning' | 'critical';

export class GardenProvider implements vscode.TreeDataProvider<GardenItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GardenItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private fileCache = new Map<string, FileMetrics>();
  private refreshTimer?: NodeJS.Timeout;
  private currentGroupBy: GroupBy = 'none';
  private currentHealthFilter: HealthFilter = 'all';
  private fileWatchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer?: NodeJS.Timeout;

  constructor(private context: vscode.ExtensionContext) {
    this.setupAutoRefresh();
    this.watchConfigChanges();
    this.setupFileWatchers();
  }

  refresh(): void {
    this.fileCache.clear();
    this._onDidChangeTreeData.fire();
    
    // Update status bar after refresh
    this.updateStatusBar();
  }

  setGroupBy(groupBy: GroupBy): void {
    this.currentGroupBy = groupBy;
    this.refresh();
  }

  setHealthFilter(filter: HealthFilter): void {
    this.currentHealthFilter = filter;
    this.refresh();
  }

  getTreeItem(element: GardenItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GardenItem): Promise<GardenItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }

    if (!element) {
      // Root level
      return this.getRootItems();
    }

    if (element instanceof GroupItem) {
      return element.children;
    }

    return [];
  }

  private async getRootItems(): Promise<GardenItem[]> {
    const config = vscode.workspace.getConfiguration('verdantView');
    const includePatterns = config.get<string[]>('includePatterns', ['**/*']);
    const excludePatterns = config.get<string[]>('excludePatterns', [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'
    ]);

    // Find all files
    const allFiles: vscode.Uri[] = [];
    for (const pattern of includePatterns) {
      const files = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);
      allFiles.push(...files);
    }

    // Remove duplicates
    const uniqueFiles = Array.from(new Set(allFiles.map(f => f.toString()))).map(s => vscode.Uri.parse(s));

    // Analyze files and create plant items
    const plantItems: PlantItem[] = [];
    for (const file of uniqueFiles) {
      try {
        let metrics = this.fileCache.get(file.toString());
        if (!metrics) {
          metrics = await FileAnalyzer.analyzeFile(file);
          this.fileCache.set(file.toString(), metrics);
        }

        // Apply health filter
        if (this.currentHealthFilter !== 'all' && metrics.health !== this.currentHealthFilter) {
          continue;
        }

        plantItems.push(new PlantItem(file, metrics, this.context));
      } catch (error) {
        console.error(`Failed to analyze file ${file.fsPath}:`, error);
      }
    }

    // Group items if needed
    if (this.currentGroupBy === 'none') {
      return plantItems.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
    }

    return this.groupItems(plantItems);
  }

  private groupItems(items: PlantItem[]): GroupItem[] {
    const groups = new Map<string, PlantItem[]>();

    items.forEach(item => {
      let groupKey: string;
      let groupLabel: string;
      let groupIcon: string;

      switch (this.currentGroupBy) {
        case 'type':
          groupKey = item.metrics.type;
          groupLabel = this.getTypeDisplayName(item.metrics.type);
          groupIcon = this.getTypeIcon(item.metrics.type);
          break;
        case 'health':
          groupKey = item.metrics.health;
          groupLabel = this.getHealthDisplayName(item.metrics.health);
          groupIcon = this.getHealthIcon(item.metrics.health);
          break;
        case 'folder':
          const folderPath = path.dirname(item.uri.fsPath);
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(item.uri);
          groupKey = folderPath;
          groupLabel = workspaceFolder 
            ? path.relative(workspaceFolder.uri.fsPath, folderPath) || 'Root'
            : path.basename(folderPath);
          groupIcon = 'folder';
          break;
        default:
          return;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    const groupItems: GroupItem[] = [];
    groups.forEach((children, key) => {
      const groupLabel = this.getGroupLabel(key);
      const groupIcon = this.getGroupIcon(key);
      children.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
      groupItems.push(new GroupItem(groupLabel, children, groupIcon, this.context));
    });

    return groupItems.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
  }

  private getGroupLabel(key: string): string {
    switch (this.currentGroupBy) {
      case 'type':
        return this.getTypeDisplayName(key);
      case 'health':
        return this.getHealthDisplayName(key);
      default:
        return key;
    }
  }

  private getGroupIcon(key: string): string {
    switch (this.currentGroupBy) {
      case 'type':
        return this.getTypeIcon(key);
      case 'health':
        return this.getHealthIcon(key);
      case 'folder':
        return 'folder';
      default:
        return 'file';
    }
  }

  private getTypeDisplayName(type: string): string {
    const typeNames: { [key: string]: string } = {
      'typescript': 'TypeScript Files',
      'javascript': 'JavaScript Files',
      'python': 'Python Files',
      'java': 'Java Files',
      'cpp': 'C++ Files',
      'css': 'CSS Files',
      'html': 'HTML Files',
      'json': 'JSON Files',
      'markdown': 'Markdown Files',
      'image': 'Image Files',
      'database': 'Database Files'
    };
    return typeNames[type] || `${type.charAt(0).toUpperCase() + type.slice(1)} Files`;
  }

  private getHealthDisplayName(health: string): string {
    const healthNames: { [key: string]: string } = {
      'healthy': '🌱 Healthy Files',
      'warning': '⚠️ Files Needing Attention',
      'critical': '🚨 Critical Files'
    };
    return healthNames[health] || health;
  }

  private getTypeIcon(type: string): string {
    return FileAnalyzer.getIconForFileType(type, 'healthy');
  }

  private getHealthIcon(health: string): string {
    switch (health) {
      case 'healthy': return 'leaf';
      case 'warning': return 'leaf-warning';
      case 'critical': return 'leaf-critical';
      default: return 'leaf';
    }
  }

  private setupAutoRefresh(): void {
    const config = vscode.workspace.getConfiguration('verdantView');
    const interval = config.get<number>('refreshInterval', 0);
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    if (interval > 0) {
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, interval * 1000);
    }
  }

  private watchConfigChanges(): void {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('verdantView')) {
        this.setupAutoRefresh();
        this.setupFileWatchers(); // Re-setup watchers when config changes
        this.refresh();
      }
    });
  }

  private setupFileWatchers(): void {
    // Clear existing watchers
    this.clearFileWatchers();

    const config = vscode.workspace.getConfiguration('verdantView');
    const enableFileWatching = config.get<boolean>('enableFileWatching', true);
    
    if (!vscode.workspace.workspaceFolders || !enableFileWatching) {
      return;
    }

    const includePatterns = config.get<string[]>('includePatterns', ['**/*']);
    const excludePatterns = config.get<string[]>('excludePatterns', [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'
    ]);

    // Create watchers for each include pattern
    includePatterns.forEach(pattern => {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      // File created
      watcher.onDidCreate(uri => {
        if (!this.shouldExcludeFile(uri, excludePatterns)) {
          this.onFileChanged(uri, 'created');
        }
      });

      // File changed
      watcher.onDidChange(uri => {
        if (!this.shouldExcludeFile(uri, excludePatterns)) {
          this.onFileChanged(uri, 'changed');
        }
      });

      // File deleted
      watcher.onDidDelete(uri => {
        if (!this.shouldExcludeFile(uri, excludePatterns)) {
          this.onFileChanged(uri, 'deleted');
        }
      });

      this.fileWatchers.push(watcher);
    });

    // Also watch for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.setupFileWatchers();
      this.debouncedRefresh();
    });
  }

  private shouldExcludeFile(uri: vscode.Uri, excludePatterns: string[]): boolean {
    const relativePath = vscode.workspace.asRelativePath(uri);
    return excludePatterns.some(pattern => {
      // Convert glob pattern to regex for matching
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(relativePath);
    });
  }

  private onFileChanged(uri: vscode.Uri, changeType: 'created' | 'changed' | 'deleted'): void {
    // Skip certain file types that don't affect the garden meaningfully
    const fileName = uri.fsPath.toLowerCase();
    const skipExtensions = ['.log', '.tmp', '.temp', '.cache', '.lock'];
    const skipFiles = ['.ds_store', 'thumbs.db', 'desktop.ini'];
    
    if (skipExtensions.some(ext => fileName.endsWith(ext)) || 
        skipFiles.some(file => fileName.endsWith(file))) {
      return;
    }
    
    // Remove from cache if it exists
    this.fileCache.delete(uri.toString());
    
    // Log the change for debugging
    console.log(`VerdantView: File ${changeType}: ${uri.fsPath}`);
    
    // Show a subtle notification for file changes (optional)
    const config = vscode.workspace.getConfiguration('verdantView');
    const showChangeNotifications = config.get<boolean>('showChangeNotifications', false);
    
    if (showChangeNotifications) {
      const fileName = vscode.workspace.asRelativePath(uri);
      const icon = changeType === 'created' ? '🌱' : changeType === 'changed' ? '🔄' : '🗑️';
      const action = changeType === 'created' ? 'sprouted' : changeType === 'changed' ? 'grew' : 'withered';
      
      vscode.window.showInformationMessage(
        `${icon} ${fileName} ${action} in your garden`,
        { modal: false }
      );
    }
    
    // Debounced refresh to avoid too many updates
    this.debouncedRefresh();
  }

  private debouncedRefresh(): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Get debounce delay from config
    const config = vscode.workspace.getConfiguration('verdantView');
    const debounceDelay = config.get<number>('debounceDelay', 300);
    
    // Set new timer with configured delay
    this.debounceTimer = setTimeout(() => {
      this.refresh();
    }, debounceDelay);
  }

  private clearFileWatchers(): void {
    this.fileWatchers.forEach(watcher => watcher.dispose());
    this.fileWatchers = [];
  }

  async exportReport(): Promise<void> {
    const items = await this.getRootItems();
    const report = this.generateReport(items);
    
    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  async getGardenSummary(): Promise<{total: number, healthy: number, warning: number, critical: number}> {
    const items = await this.getRootItems();
    const plantItems = items.filter(item => item instanceof PlantItem) as PlantItem[];
    
    return {
      total: plantItems.length,
      healthy: plantItems.filter(item => item.metrics.health === 'healthy').length,
      warning: plantItems.filter(item => item.metrics.health === 'warning').length,
      critical: plantItems.filter(item => item.metrics.health === 'critical').length
    };
  }

  private generateReport(items: GardenItem[]): string {
    const plantItems = items.filter(item => item instanceof PlantItem) as PlantItem[];
    
    const total = plantItems.length;
    const healthy = plantItems.filter(item => item.metrics.health === 'healthy').length;
    const warning = plantItems.filter(item => item.metrics.health === 'warning').length;
    const critical = plantItems.filter(item => item.metrics.health === 'critical').length;
    
    const totalSize = plantItems.reduce((sum, item) => sum + item.metrics.size, 0);
    const totalLines = plantItems.reduce((sum, item) => sum + item.metrics.lines, 0);
    const avgComplexity = plantItems.reduce((sum, item) => sum + item.metrics.complexity, 0) / total;

    let report = `# Verdant Garden Report\n\n`;
    report += `Generated on: ${new Date().toLocaleString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Files**: ${total}\n`;
    report += `- **Healthy**: ${healthy} (${Math.round(healthy/total*100)}%)\n`;
    report += `- **Warning**: ${warning} (${Math.round(warning/total*100)}%)\n`;
    report += `- **Critical**: ${critical} (${Math.round(critical/total*100)}%)\n`;
    report += `- **Total Size**: ${Math.round(totalSize/1024)}KB\n`;
    report += `- **Total Lines**: ${totalLines.toLocaleString()}\n`;
    report += `- **Average Complexity**: ${avgComplexity.toFixed(1)}\n\n`;

    if (critical > 0) {
      report += `## Critical Files\n\n`;
      plantItems
        .filter(item => item.metrics.health === 'critical')
        .forEach(item => {
          report += `- **${item.label}**: ${item.metrics.issues.join(', ')}\n`;
        });
      report += `\n`;
    }

    if (warning > 0) {
      report += `## Files Needing Attention\n\n`;
      plantItems
        .filter(item => item.metrics.health === 'warning')
        .forEach(item => {
          report += `- **${item.label}**: ${item.metrics.issues.join(', ')}\n`;
        });
      report += `\n`;
    }

    return report;
  }

  private async updateStatusBar(): Promise<void> {
    try {
      const summary = await this.getGardenSummary();
      // Emit an event that the extension can listen to for status bar updates
      vscode.commands.executeCommand('verdantview.updateStatusBar', summary);
    } catch (error) {
      console.error('Failed to update status bar:', error);
    }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.clearFileWatchers();
  }
}

export abstract class GardenItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    protected context: vscode.ExtensionContext
  ) {
    super(label, collapsibleState);
  }
}

export class PlantItem extends GardenItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly metrics: FileMetrics,
    context: vscode.ExtensionContext
  ) {
    super(path.basename(uri.fsPath), vscode.TreeItemCollapsibleState.None, context);

    this.tooltip = this.createTooltip();
    this.description = this.createDescription();
    this.iconPath = this.getIcon();
    this.command = { command: 'vscode.open', title: 'Open File', arguments: [uri] };
    this.contextValue = 'plantItem';
  }

  private createTooltip(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${path.basename(this.uri.fsPath)}**\n\n`);
    tooltip.appendMarkdown(`📁 ${this.uri.fsPath}\n\n`);
    tooltip.appendMarkdown(`**Metrics:**\n`);
    tooltip.appendMarkdown(`- Lines: ${this.metrics.lines.toLocaleString()}\n`);
    tooltip.appendMarkdown(`- Size: ${Math.round(this.metrics.size/1024)}KB\n`);
    tooltip.appendMarkdown(`- Complexity: ${this.metrics.complexity}\n`);
    tooltip.appendMarkdown(`- Type: ${this.metrics.type}\n`);
    tooltip.appendMarkdown(`- Health: ${this.metrics.health}\n`);
    tooltip.appendMarkdown(`- Last Modified: ${this.metrics.lastModified.toLocaleDateString()}\n\n`);
    
    if (this.metrics.issues.length > 0) {
      tooltip.appendMarkdown(`**Issues:**\n`);
      this.metrics.issues.forEach(issue => {
        tooltip.appendMarkdown(`- ${issue}\n`);
      });
    }
    
    return tooltip;
  }

  private createDescription(): string {
    const config = vscode.workspace.getConfiguration('verdantView');
    const showMetrics = config.get<string[]>('showMetrics', ['complexity', 'size', 'lastModified']);
    
    const parts: string[] = [];
    
    if (showMetrics.includes('complexity')) {
      parts.push(`C:${this.metrics.complexity}`);
    }
    if (showMetrics.includes('size')) {
      parts.push(`${Math.round(this.metrics.size/1024)}KB`);
    }
    if (showMetrics.includes('lastModified')) {
      const days = Math.floor((Date.now() - this.metrics.lastModified.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        parts.push(`${days}d ago`);
      }
    }
    
    return parts.join(' • ');
  }

  private getIcon(): { light: vscode.Uri; dark: vscode.Uri } {
    const iconName = FileAnalyzer.getIconForFileType(this.metrics.type, this.metrics.health);
    const iconFile = `${iconName}.svg`;

    return {
      light: vscode.Uri.file(
        this.context.asAbsolutePath(path.join('resources', 'light', iconFile))
      ),
      dark: vscode.Uri.file(
        this.context.asAbsolutePath(path.join('resources', 'dark', iconFile))
      )
    };
  }
}

export class GroupItem extends GardenItem {
  constructor(
    label: string,
    public readonly children: PlantItem[],
    private iconName: string,
    context: vscode.ExtensionContext
  ) {
    super(`${label} (${children.length})`, vscode.TreeItemCollapsibleState.Expanded, context);
    
    this.tooltip = this.createGroupTooltip();
    this.iconPath = this.getGroupIcon();
    this.contextValue = 'groupItem';
  }

  private createGroupTooltip(): string {
    const healthy = this.children.filter(c => c.metrics.health === 'healthy').length;
    const warning = this.children.filter(c => c.metrics.health === 'warning').length;
    const critical = this.children.filter(c => c.metrics.health === 'critical').length;
    
    return `${this.children.length} files - Healthy: ${healthy}, Warning: ${warning}, Critical: ${critical}`;
  }

  private getGroupIcon(): { light: vscode.Uri; dark: vscode.Uri } {
    const iconFile = `${this.iconName}.svg`;
    
    return {
      light: vscode.Uri.file(
        this.context.asAbsolutePath(path.join('resources', 'light', iconFile))
      ),
      dark: vscode.Uri.file(
        this.context.asAbsolutePath(path.join('resources', 'dark', iconFile))
      )
    };
  }
}
