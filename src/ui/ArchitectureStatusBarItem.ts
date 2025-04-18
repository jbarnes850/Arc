/**
 * ARC Architecture Status Bar Item
 * 
 * Provides a status bar item for quick access to the architecture panel.
 */

import * as vscode from 'vscode';

export class ArchitectureStatusBarItem {
  private static instance: ArchitectureStatusBarItem;
  private statusBarItem: vscode.StatusBarItem;

  private constructor(private readonly context: vscode.ExtensionContext) {
    // Create the status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.text = '$(project) ARC';
    this.statusBarItem.tooltip = 'View System Architecture';
    this.statusBarItem.command = 'arc.showArchitecturePanel';
    
    // Add to subscriptions
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Get the singleton instance of ArchitectureStatusBarItem
   */
  public static getInstance(context: vscode.ExtensionContext): ArchitectureStatusBarItem {
    if (!ArchitectureStatusBarItem.instance) {
      ArchitectureStatusBarItem.instance = new ArchitectureStatusBarItem(context);
    }
    return ArchitectureStatusBarItem.instance;
  }

  /**
   * Show the status bar item
   */
  public show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item
   */
  public hide(): void {
    this.statusBarItem.hide();
  }
}
