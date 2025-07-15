import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface FileMetrics {
  lines: number;
  size: number;
  complexity: number;
  lastModified: Date;
  type: string;
  health: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

export interface HealthThresholds {
  complexity: { warning: number; critical: number };
  size: { warning: number; critical: number };
  age: { warning: number; critical: number };
}

export class FileAnalyzer {
  private static readonly FILE_TYPE_ICONS = new Map([
    // Programming languages
    ['.ts', 'typescript'],
    ['.js', 'javascript'],
    ['.tsx', 'react'],
    ['.jsx', 'react'],
    ['.py', 'python'],
    ['.java', 'java'],
    ['.cpp', 'cpp'],
    ['.c', 'c'],
    ['.cs', 'csharp'],
    ['.php', 'php'],
    ['.rb', 'ruby'],
    ['.go', 'go'],
    ['.rs', 'rust'],
    ['.swift', 'swift'],
    ['.kt', 'kotlin'],
    ['.scala', 'scala'],
    ['.dart', 'dart'],
    
    // Web technologies
    ['.html', 'html'],
    ['.css', 'css'],
    ['.scss', 'sass'],
    ['.sass', 'sass'],
    ['.less', 'less'],
    ['.vue', 'vue'],
    ['.svelte', 'svelte'],
    
    // Data formats
    ['.json', 'json'],
    ['.xml', 'xml'],
    ['.yaml', 'yaml'],
    ['.yml', 'yaml'],
    ['.toml', 'toml'],
    ['.csv', 'csv'],
    
    // Documentation
    ['.md', 'markdown'],
    ['.txt', 'text'],
    ['.rst', 'text'],
    ['.tex', 'latex'],
    
    // Configuration
    ['.env', 'settings'],
    ['.ini', 'settings'],
    ['.conf', 'settings'],
    ['.config', 'settings'],
    
    // Build/Package
    ['.dockerfile', 'docker'],
    ['dockerfile', 'docker'],
    ['.jenkinsfile', 'jenkins'],
    ['makefile', 'make'],
    ['package.json', 'npm'],
    ['cargo.toml', 'rust'],
    ['pom.xml', 'java'],
    ['build.gradle', 'gradle'],
    
    // Images
    ['.png', 'image'],
    ['.jpg', 'image'],
    ['.jpeg', 'image'],
    ['.gif', 'image'],
    ['.svg', 'image'],
    ['.ico', 'image'],
    
    // Others
    ['.sql', 'database'],
    ['.db', 'database'],
    ['.sqlite', 'database'],
    ['.log', 'log'],
    ['.lock', 'lock']
  ]);

  static async analyzeFile(uri: vscode.Uri): Promise<FileMetrics> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString('utf8');
      
      const ext = path.extname(uri.fsPath).toLowerCase();
      const basename = path.basename(uri.fsPath).toLowerCase();
      
      const lines = text.split('\n').length;
      const size = stat.size;
      const lastModified = new Date(stat.mtime);
      const complexity = this.calculateComplexity(text, ext);
      const type = this.getFileType(ext, basename);
      
      const thresholds = this.getHealthThresholds();
      const { health, issues } = this.assessHealth(lines, size, complexity, lastModified, thresholds);
      
      return {
        lines,
        size,
        complexity,
        lastModified,
        type,
        health,
        issues
      };
    } catch (error) {
      return {
        lines: 0,
        size: 0,
        complexity: 0,
        lastModified: new Date(),
        type: 'unknown',
        health: 'critical',
        issues: [`Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private static calculateComplexity(content: string, ext: string): number {
    let complexity = 0;
    
    // Basic complexity indicators
    const complexityPatterns = [
      /\bif\b/gi,
      /\belse\b/gi,
      /\bfor\b/gi,
      /\bwhile\b/gi,
      /\bswitch\b/gi,
      /\bcase\b/gi,
      /\btry\b/gi,
      /\bcatch\b/gi,
      /\bfunction\b/gi,
      /\bclass\b/gi,
      /\binterface\b/gi,
      /=>|{|}|\[|\]/g, // Brackets and arrows
    ];

    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    // Language-specific complexity
    switch (ext) {
      case '.ts':
      case '.js':
      case '.tsx':
      case '.jsx':
        // Additional JS/TS complexity
        complexity += (content.match(/\basync\b/gi) || []).length;
        complexity += (content.match(/\bawait\b/gi) || []).length;
        complexity += (content.match(/\bPromise\b/gi) || []).length;
        break;
      case '.py':
        // Python complexity
        complexity += (content.match(/\bdef\b/gi) || []).length;
        complexity += (content.match(/\bclass\b/gi) || []).length;
        complexity += (content.match(/\bexcept\b/gi) || []).length;
        break;
    }

    return Math.max(1, Math.floor(complexity / 10));
  }

  private static getFileType(ext: string, basename: string): string {
    return this.FILE_TYPE_ICONS.get(ext) || 
           this.FILE_TYPE_ICONS.get(basename) || 
           'file';
  }

  private static getHealthThresholds(): HealthThresholds {
    const config = vscode.workspace.getConfiguration('verdantView');
    return config.get('healthThresholds', {
      complexity: { warning: 10, critical: 20 },
      size: { warning: 500, critical: 1000 },
      age: { warning: 30, critical: 90 }
    });
  }

  private static assessHealth(
    lines: number, 
    size: number, 
    complexity: number, 
    lastModified: Date, 
    thresholds: HealthThresholds
  ): { health: 'healthy' | 'warning' | 'critical'; issues: string[] } {
    const issues: string[] = [];
    let healthScore = 0;

    const now = new Date();
    const daysSinceModified = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
    const sizeKB = Math.floor(size / 1024);

    // Check complexity
    if (complexity >= thresholds.complexity.critical) {
      healthScore += 2;
      issues.push(`High complexity (${complexity})`);
    } else if (complexity >= thresholds.complexity.warning) {
      healthScore += 1;
      issues.push(`Moderate complexity (${complexity})`);
    }

    // Check size
    if (sizeKB >= thresholds.size.critical) {
      healthScore += 2;
      issues.push(`Large file (${sizeKB}KB)`);
    } else if (sizeKB >= thresholds.size.warning) {
      healthScore += 1;
      issues.push(`Medium file (${sizeKB}KB)`);
    }

    // Check age
    if (daysSinceModified >= thresholds.age.critical) {
      healthScore += 1;
      issues.push(`Not modified for ${daysSinceModified} days`);
    } else if (daysSinceModified >= thresholds.age.warning) {
      issues.push(`Last modified ${daysSinceModified} days ago`);
    }

    // Determine overall health
    let health: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 3) {
      health = 'critical';
    } else if (healthScore >= 1) {
      health = 'warning';
    } else {
      health = 'healthy';
    }

    return { health, issues };
  }

  static getIconForFileType(type: string, health: 'healthy' | 'warning' | 'critical'): string {
    const healthSuffix = health === 'healthy' ? '' : `-${health}`;
    
    switch (type) {
      case 'folder':
        return 'folder';
      case 'typescript':
      case 'javascript':
      case 'react':
        return `leaf${healthSuffix}`;
      case 'python':
      case 'java':
      case 'cpp':
        return `flower-${health}`;
      default:
        return `leaf${healthSuffix}`;
    }
  }
}
