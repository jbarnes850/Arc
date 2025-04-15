/**
 * Global type declarations for ARC
 * 
 * This is a pragmatic solution to resolve type issues without adding complexity.
 * It allows us to focus on core functionality while maintaining type safety where it matters.
 */

// Declare VS Code module with necessary types
declare module 'vscode' {
  export const window: any;
  export const workspace: any;
  export const commands: any;
  export const ViewColumn: any;
  export const ProgressLocation: any;
  export const Uri: any;
  
  export class TreeItem {
    constructor(label: string, collapsibleState?: number);
    label?: string;
    description?: string;
    tooltip?: string;
    iconPath?: any;
    command?: any;
    contextValue?: string;
  }
  
  export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
  }
  
  export interface ExtensionContext {
    subscriptions: any[];
    globalState: {
      get(key: string, defaultValue?: any): any;
      update(key: string, value: any): Thenable<void>;
    };
    globalStorageUri: { fsPath: string };
  }
  
  export interface Progress<T> {
    report(value: T): void;
  }
  
  export interface TextDocument {
    uri: { fsPath: string };
    fileName: string;
    getText(): string;
    save(): Thenable<boolean>;
  }
}

// Declare Node.js modules
declare module 'path';
declare module 'fs';

// Declare SQLite module
declare module 'sqlite3' {
  export class Database {
    constructor(filename: string, callback?: (err: any) => void);
    run(sql: string, params?: any, callback?: (err: any) => void): this;
    get(sql: string, params?: any, callback?: (err: any, row: any) => void): this;
    all(sql: string, params?: any, callback?: (err: any, rows: any[]) => void): this;
    exec(sql: string, callback?: (err: any) => void): this;
  }
  
  export function verbose(): any;
}

// Extend Node.js crypto module
declare module 'crypto' {
  export function createHash(algorithm: string): {
    update(data: string): {
      digest(encoding: string): string;
    };
  };
}
