import * as path from 'path';
import * as fs from 'fs';

import BetterSQLite3 from 'better-sqlite3';

import {
  IPersistenceService
} from './IPersistenceService';
import {
  Developer,
  Repository,
  Commit,
  CodeElement,
  CodeElementVersion,
  DecisionRecord
} from '../models/types';

// Define SQLite error type to avoid 'any' type errors
type SQLiteError = {
  message: string;
  code?: string;
};

/**
 * SQLite implementation of the IPersistenceService
 */
export class SQLitePersistenceService implements IPersistenceService {
  // Using `any` to allow legacy run/get/all calls; will refactor to Statement API later
  private db: any = null;
  private dbPath: string;

  constructor(contextOrPath: any) {
    try {
      // Check if we're given a direct path or a VS Code extension context
      if (typeof contextOrPath === 'string') {
        // Direct path to the database file
        this.dbPath = contextOrPath;
      } else if (contextOrPath && contextOrPath.globalStorageUri && contextOrPath.globalStorageUri.fsPath) {
        // VS Code extension context
        this.dbPath = path.join(contextOrPath.globalStorageUri.fsPath, 'arc-knowledge-graph.db');
      } else {
        // Fallback to a temporary path if context is invalid
        const tempDir = require('os').tmpdir();
        this.dbPath = path.join(tempDir, 'arc-knowledge-graph.db');
        console.warn('Invalid context provided to SQLitePersistenceService, using temporary path:', this.dbPath);
      }

      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      console.log('SQLitePersistenceService initialized with database path:', this.dbPath);
    } catch (error) {
      console.error('Error in SQLitePersistenceService constructor:', error);
      // Fallback to a temporary path if there's an error
      const tempDir = require('os').tmpdir();
      this.dbPath = path.join(tempDir, 'arc-knowledge-graph-fallback.db');
      console.warn('Using fallback database path due to error:', this.dbPath);
    }
  }

  /**
   * Initialize the database with the required schema
   */
  async initializeDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Instantiate DB
        console.log(`Initializing database at path: ${this.dbPath}`);

        // Ensure the directory exists again (just to be safe)
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
          console.log(`Creating database directory: ${dbDir}`);
          fs.mkdirSync(dbDir, { recursive: true });
        }

        // Check if the database path is valid
        if (!this.dbPath) {
          const tempDir = require('os').tmpdir();
          this.dbPath = path.join(tempDir, 'arc-knowledge-graph-emergency.db');
          console.warn('Database path is invalid, using emergency path:', this.dbPath);
        }

        // Try to instantiate the database with more detailed error handling
        try {
          // Use a timeout to prevent hanging if the database is locked
          const timeout = setTimeout(() => {
            console.error('Database initialization timed out');
            if (typeof require !== 'undefined') {
              try {
                const vscode = require('vscode');
                vscode.window.showErrorMessage('Database initialization timed out. The database may be locked by another process.');
              } catch (_) {}
            }
            reject(new Error('Database initialization timed out'));
          }, 10000); // 10 second timeout

          this.db = new BetterSQLite3(this.dbPath, {
            // Adding verbose option for better diagnostics
            verbose: console.log,
            // Set a timeout for database operations
            timeout: 5000
          }) as any;

          // Clear the timeout if successful
          clearTimeout(timeout);
        } catch (dbError) {
          console.error('Error instantiating BetterSQLite3:', dbError);
          if (typeof dbError === 'object' && dbError && 'stack' in dbError) {
            console.error('Stack:', (dbError as Error).stack);
          }
          // Log to VS Code output channel if available
          if ((global as any).arcOutputChannel) {
            (global as any).arcOutputChannel.appendLine('ARC DB initialization error: ' + (dbError && dbError.stack ? dbError.stack : dbError));
          }
          // Show error popup in VS Code if available
          if (typeof require !== 'undefined') {
            try {
              const vscode = require('vscode');
              vscode.window.showErrorMessage(`Failed to initialize ARC database: ${dbError && dbError.message ? dbError.message : dbError}`);
            } catch (_) {}
          }
          throw new Error(`Failed to create SQLite database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }

        // Set pragmas with error handling
        try {
          this.db.pragma('journal_mode = WAL');
          this.db.pragma('synchronous = NORMAL');
          this.db.pragma('temp_store = MEMORY');
          this.db.pragma('foreign_keys = ON');
        } catch (pragmaError) {
          console.error('Error setting SQLite pragmas:', pragmaError);
          if (typeof pragmaError === 'object' && pragmaError && 'stack' in pragmaError) {
            console.error('Stack:', (pragmaError as Error).stack);
          }
          if ((global as any).arcOutputChannel) {
            (global as any).arcOutputChannel.appendLine('ARC DB pragma error: ' + (pragmaError && pragmaError.stack ? pragmaError.stack : pragmaError));
          }
          if (typeof require !== 'undefined') {
            try {
              const vscode = require('vscode');
              vscode.window.showErrorMessage(`Failed to set ARC DB pragmas: ${pragmaError && pragmaError.message ? pragmaError.message : pragmaError}`);
            } catch (_) {}
          }
          throw new Error(`Failed to set SQLite pragmas: ${pragmaError instanceof Error ? pragmaError.message : String(pragmaError)}`);
        }

        const schema = `
          -- Repositories table
          CREATE TABLE IF NOT EXISTS repositories (
            repo_id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT
          );

          -- Developers table
          CREATE TABLE IF NOT EXISTS developers (
            dev_id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL UNIQUE
          );
          CREATE INDEX IF NOT EXISTS idx_developers_email ON developers(email);

          -- Commits table
          CREATE TABLE IF NOT EXISTS commits (
            commit_hash TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL,
            message TEXT NOT NULL,
            commit_timestamp INTEGER NOT NULL,
            author_dev_id TEXT NOT NULL,
            committer_dev_id TEXT NOT NULL,
            FOREIGN KEY (repo_id) REFERENCES repositories(repo_id),
            FOREIGN KEY (author_dev_id) REFERENCES developers (dev_id),
            FOREIGN KEY (committer_dev_id) REFERENCES developers (dev_id)
          );
          CREATE INDEX IF NOT EXISTS idx_commits_repo_id ON commits(repo_id);
          CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(commit_timestamp);
          CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author_dev_id);

          -- Commit parents table
          CREATE TABLE IF NOT EXISTS commit_parents (
            commit_hash TEXT NOT NULL,
            parent_hash TEXT NOT NULL,
            PRIMARY KEY (commit_hash, parent_hash),
            FOREIGN KEY (commit_hash) REFERENCES commits(commit_hash),
            FOREIGN KEY (parent_hash) REFERENCES commits(commit_hash)
          );
          CREATE INDEX IF NOT EXISTS idx_commit_parents_commit ON commit_parents(commit_hash);
          CREATE INDEX IF NOT EXISTS idx_commit_parents_parent ON commit_parents(parent_hash);

          -- Code elements table
          CREATE TABLE IF NOT EXISTS code_elements (
            element_id TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('file', 'class', 'function')),
            stable_identifier TEXT NOT NULL,
            FOREIGN KEY (repo_id) REFERENCES repositories (repo_id),
            UNIQUE (repo_id, stable_identifier)
          );
          CREATE INDEX IF NOT EXISTS idx_code_elements_repo ON code_elements(repo_id);
          CREATE INDEX IF NOT EXISTS idx_code_elements_stable_id ON code_elements(stable_identifier);

          -- Code element versions table
          CREATE TABLE IF NOT EXISTS code_element_versions (
            version_id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            name TEXT,
            start_line INTEGER,
            end_line INTEGER,
            previous_version_id TEXT,
            FOREIGN KEY (element_id) REFERENCES code_elements (element_id),
            FOREIGN KEY (commit_hash) REFERENCES commits (commit_hash),
            FOREIGN KEY (previous_version_id) REFERENCES code_element_versions (version_id)
          );
          CREATE INDEX IF NOT EXISTS idx_code_element_versions_element ON code_element_versions(element_id);
          CREATE INDEX IF NOT EXISTS idx_code_element_versions_commit ON code_element_versions(commit_hash);
          CREATE INDEX IF NOT EXISTS idx_code_element_versions_previous ON code_element_versions(previous_version_id);

          -- Decision records table
          CREATE TABLE IF NOT EXISTS decision_records (
            decision_id TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            author_dev_id TEXT,
            FOREIGN KEY (repo_id) REFERENCES repositories (repo_id),
            FOREIGN KEY (author_dev_id) REFERENCES developers (dev_id)
          );
          CREATE INDEX IF NOT EXISTS idx_decision_records_repo ON decision_records(repo_id);

          -- Decision references code table (for REFERENCES relationship)
          CREATE TABLE IF NOT EXISTS decision_references_code (
            decision_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            PRIMARY KEY (decision_id, version_id),
            FOREIGN KEY (decision_id) REFERENCES decision_records (decision_id),
            FOREIGN KEY (version_id) REFERENCES code_element_versions (version_id)
          );
          CREATE INDEX IF NOT EXISTS idx_decision_references_decision ON decision_references_code(decision_id);
          CREATE INDEX IF NOT EXISTS idx_decision_references_version ON decision_references_code(version_id);

          -- File hashes table
          CREATE TABLE IF NOT EXISTS file_hashes (
            repo_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            PRIMARY KEY (repo_id, file_path),
            FOREIGN KEY (repo_id) REFERENCES repositories(repo_id)
          );
          CREATE INDEX IF NOT EXISTS idx_file_hashes_repo_id ON file_hashes(repo_id);
        `;

        try {
          // Execute schema creation in a transaction
          const batch = this.db.transaction(() => this.db.exec(schema));
          batch();
          console.log('Database schema created successfully');
          resolve();
        } catch (schemaError) {
          console.error('Error creating database schema:', schemaError);
          if (typeof schemaError === 'object' && schemaError && 'stack' in schemaError) {
            console.error('Stack:', (schemaError as Error).stack);
          }
          if ((global as any).arcOutputChannel) {
            (global as any).arcOutputChannel.appendLine('ARC DB schema error: ' + (schemaError && schemaError.stack ? schemaError.stack : schemaError));
          }
          if (typeof require !== 'undefined') {
            try {
              const vscode = require('vscode');
              vscode.window.showErrorMessage(`Failed to create ARC DB schema: ${schemaError && schemaError.message ? schemaError.message : schemaError}`);
            } catch (_) {}
          }
          throw new Error(`Failed to create database schema: ${schemaError instanceof Error ? schemaError.message : String(schemaError)}`);
        }
      } catch (error) {
        console.error('Error in database initialization process:', error);
        if (typeof error === 'object' && error && 'stack' in error) {
          console.error('Stack:', (error as Error).stack);
        }
        // Check if the error is related to file permissions
        if (error.message && error.message.includes('permission')) {
          console.error('This may be a file permission issue. Check if the extension has write access to:', this.dbPath);
        }
        // Check if the error is related to the SQLite binary
        if (error.message && error.message.includes('bindings')) {
          console.error('This may be an issue with the SQLite native bindings. Check if better-sqlite3 is properly installed.');
        }
        if ((global as any).arcOutputChannel) {
          (global as any).arcOutputChannel.appendLine('ARC DB general error: ' + (error && error.stack ? error.stack : error));
        }
        if (typeof require !== 'undefined') {
          try {
            const vscode = require('vscode');
            vscode.window.showErrorMessage(`Failed to initialize ARC database: ${error && error.message ? error.message : error}`);
          } catch (_) {}
        }
        reject(error);
      }
    });
  }

  // Repository operations
  async saveRepository(repository: Repository): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO repositories (repo_id, path, name)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [repository.repoId, repository.path, repository.name], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    return new Promise<Repository | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM repositories WHERE repo_id = ?
      `;

      this.db.get(sql, [repoId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          repoId: row.repo_id,
          path: row.path,
          name: row.name
        });
      });
    });
  }

  async getRepositoryIds(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT repo_id FROM repositories
      `;

      this.db.all(sql, [], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows.map(row => row.repo_id));
      });
    });
  }

  // Developer operations
  async saveDeveloper(developer: Developer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO developers (dev_id, name, email)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [developer.devId, developer.name, developer.email], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getDeveloperByEmail(email: string): Promise<Developer | null> {
    return new Promise<Developer | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM developers WHERE email = ?
      `;

      this.db.get(sql, [email], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          devId: row.dev_id,
          name: row.name,
          email: row.email
        });
      });
    });
  }

  // Commit operations
  async saveCommit(commit: Commit): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO commits (commit_hash, repo_id, message, commit_timestamp, author_dev_id, committer_dev_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          commit.commitHash,
          commit.repoId,
          commit.message,
          commit.timestamp,
          commit.authorDevId,
          commit.committerDevId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCommit(commitHash: string): Promise<Commit | null> {
    return new Promise<Commit | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM commits WHERE commit_hash = ?
      `;

      this.db.get(sql, [commitHash], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          commitHash: row.commit_hash,
          repoId: row.repo_id,
          message: row.message,
          timestamp: row.commit_timestamp,
          authorDevId: row.author_dev_id,
          committerDevId: row.committer_dev_id
        });
      });
    });
  }

  // CodeElement operations
  async saveCodeElement(codeElement: CodeElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO code_elements (element_id, repo_id, type, stable_identifier)
        VALUES (?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          codeElement.elementId,
          codeElement.repoId,
          codeElement.type,
          codeElement.stableIdentifier
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCodeElement(elementId: string): Promise<CodeElement | null> {
    return new Promise<CodeElement | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_elements WHERE element_id = ?
      `;

      this.db.get(sql, [elementId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        });
      });
    });
  }

  async getCodeElementByIdentifier(repoId: string, stableIdentifier: string): Promise<CodeElement | null> {
    return new Promise<CodeElement | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_elements
        WHERE repo_id = ? AND stable_identifier = ?
      `;

      this.db.get(sql, [repoId, stableIdentifier], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        });
      });
    });
  }

  /**
   * List all code elements in a repository
   */
  async getAllCodeElements(repoId: string): Promise<CodeElement[]> {
    return new Promise<CodeElement[]>((resolve, reject) => {
      if (!this.db) { reject(new Error('Database not initialized')); return; }
      const sql = `SELECT * FROM code_elements WHERE repo_id = ?`;
      this.db.all(sql, [repoId], (err: any, rows: any[]) => {
        if (err) { reject(err); return; }
        const elements = rows.map(row => ({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        }));
        resolve(elements);
      });
    });
  }

  // CodeElementVersion operations
  async saveCodeElementVersion(version: CodeElementVersion): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO code_element_versions
        (version_id, element_id, commit_hash, name, start_line, end_line, previous_version_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          version.versionId,
          version.elementId,
          version.commitHash,
          version.name,
          version.startLine,
          version.endLine,
          version.previousVersionId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCodeElementVersion(versionId: string): Promise<CodeElementVersion | null> {
    return new Promise<CodeElementVersion | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_element_versions WHERE version_id = ?
      `;

      this.db.get(sql, [versionId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          versionId: row.version_id,
          elementId: row.element_id,
          commitHash: row.commit_hash,
          name: row.name,
          startLine: row.start_line,
          endLine: row.end_line,
          previousVersionId: row.previous_version_id
        });
      });
    });
  }

  async findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null> {
    return new Promise<CodeElementVersion | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT v.* FROM code_element_versions v
        JOIN commits c ON v.commit_hash = c.commit_hash
        WHERE v.element_id = ?
        ORDER BY c.commit_timestamp DESC
        LIMIT 1
      `;

      this.db.get(sql, [elementId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          versionId: row.version_id,
          elementId: row.element_id,
          commitHash: row.commit_hash,
          name: row.name,
          startLine: row.start_line,
          endLine: row.end_line,
          previousVersionId: row.previous_version_id
        });
      });
    });
  }

  async getCommitHistoryForElementId(elementId: string, limit?: number): Promise<Commit[]> {
    return new Promise<Commit[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const limitClause = limit ? `LIMIT ${limit}` : '';

      const sql = `
        SELECT c.* FROM commits c
        JOIN code_element_versions v ON c.commit_hash = v.commit_hash
        WHERE v.element_id = ?
        ORDER BY c.commit_timestamp DESC
        ${limitClause}
      `;

      this.db.all(sql, [elementId], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const commits = rows.map(row => ({
          commitHash: row.commit_hash,
          repoId: row.repo_id,
          message: row.message,
          timestamp: row.commit_timestamp,
          authorDevId: row.author_dev_id,
          committerDevId: row.committer_dev_id
        }));

        resolve(commits);
      });
    });
  }

  async getCodeElementVersions(elementId: string, commitHash: string): Promise<CodeElementVersion | null> {
    return new Promise<CodeElementVersion | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_element_versions
        WHERE element_id = ? AND commit_hash = ?
      `;

      this.db.get(sql, [elementId, commitHash], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          versionId: row.version_id,
          elementId: row.element_id,
          commitHash: row.commit_hash,
          name: row.name,
          startLine: row.start_line,
          endLine: row.end_line,
          previousVersionId: row.previous_version_id
        });
      });
    });
  }

  // DecisionRecord operations
  async saveDecisionRecord(decision: DecisionRecord): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO decision_records
        (decision_id, repo_id, title, content, created_at, author_dev_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          decision.decisionId,
          decision.repoId,
          decision.title,
          decision.content,
          decision.createdAt,
          decision.authorDevId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getDecisionRecord(decisionId: string): Promise<DecisionRecord | null> {
    return new Promise<DecisionRecord | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM decision_records WHERE decision_id = ?
      `;

      this.db.get(sql, [decisionId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          decisionId: row.decision_id,
          repoId: row.repo_id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          authorDevId: row.author_dev_id
        });
      });
    });
  }

  async findDecisionRecordsLinkedToVersion(versionId: string): Promise<DecisionRecord[]> {
    return new Promise<DecisionRecord[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT d.* FROM decision_records d
        JOIN decision_references_code r ON d.decision_id = r.decision_id
        WHERE r.version_id = ?
      `;

      this.db.all(sql, [versionId], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const decisions = rows.map(row => ({
          decisionId: row.decision_id,
          repoId: row.repo_id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          authorDevId: row.author_dev_id
        }));

        resolve(decisions);
      });
    });
  }

  // Relationship operations
  async linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO decision_references_code (decision_id, version_id)
        VALUES (?, ?)
      `;

      this.db.run(sql, [decisionId, versionId], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async linkVersionToPreviousVersion(versionId: string, previousVersionId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE code_element_versions
        SET previous_version_id = ?
        WHERE version_id = ?
      `;

      this.db.run(sql, [previousVersionId, versionId], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // File-hash cache operations
  async saveFileHash(repoId: string, filePath: string, fileHash: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO file_hashes (repo_id, file_path, file_hash)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [repoId, filePath, fileHash], (err: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getFileHash(repoId: string, filePath: string): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT file_hash FROM file_hashes WHERE repo_id = ? AND file_path = ?
      `;

      this.db.get(sql, [repoId, filePath], (err: any, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ? row.file_hash : null);
      });
    });
  }

  // Count operations
  async getCodeElementCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM code_elements WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get code element count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  async getCommitCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM commits WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get commit count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  // Commit parent operations
  async saveCommitParent(commitHash: string, parentHash: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO commit_parents (commit_hash, parent_hash)
        VALUES (?, ?)
      `;

      this.db.run(sql, [commitHash, parentHash], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getCommitParents(commitHash: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT parent_hash FROM commit_parents WHERE commit_hash = ?
      `;

      this.db.all(sql, [commitHash], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const parentHashes = rows.map(row => row.parent_hash);
        resolve(parentHashes);
      });
    });
  }

  async getCommitChildren(parentHash: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT commit_hash FROM commit_parents WHERE parent_hash = ?
      `;

      this.db.all(sql, [parentHash], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const childHashes = rows.map(row => row.commit_hash);
        resolve(childHashes);
      });
    });
  }

  async getDecisionCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM decision_records WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get decision count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  /**
   * Close the database connection
   */
  async closeConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        // No connection to close
        resolve();
        return;
      }

      try {
        // Close the database connection
        this.db.close();
        this.db = null;
        console.log('Database connection closed');
        resolve();
      } catch (error) {
        console.error('Error closing database connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Clear any caches to free up memory
   */
  clearCaches(): void {
    console.log('Clearing SQLitePersistenceService caches...');

    // Clear any statement caches
    if (this.db) {
      try {
        // Run PRAGMA to shrink the database
        this.db.pragma('shrink_memory');

        // Run VACUUM to optimize the database
        this.db.exec('VACUUM');

        console.log('Database caches cleared and optimized');
      } catch (error) {
        console.error('Error clearing database caches:', error);
      }
    }
  }
}
