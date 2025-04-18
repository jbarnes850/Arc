import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Parser from 'web-tree-sitter';
import { ICodeParserService } from './ICodeParserService';
import { CodeElement } from '../models/types';

const extensionPath = path.resolve(__dirname, '../../');

/**
 * Implementation of ICodeParserService using tree-sitter
 */
export class CodeParserService implements ICodeParserService {
  private parser: Parser | null = null;
  private language: Parser.Language | null = null;
  private supportedExtensions: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'typescript', // We'll use the TypeScript parser for JavaScript too
    '.py': 'python'
  };

  /**
   * Initialize the parser with the appropriate language
   * @param language Programming language to use ('typescript' | 'python')
   */
  async initializeParser(language: 'typescript' | 'python'): Promise<void> {
    try {
      // Initialize tree-sitter
      await Parser.init();
      this.parser = new Parser();

      // Load the language grammar
      // First try the direct path in node_modules
      let wasmPath = path.join(
        extensionPath,
        'node_modules',
        `tree-sitter-${language}`,
        `tree-sitter-${language}.wasm`
      );

      // If not found, try the pnpm path structure
      if (!fs.existsSync(wasmPath)) {
        wasmPath = path.join(
          extensionPath,
          'node_modules',
          '.pnpm',
          `tree-sitter-${language}@*`,
          'node_modules',
          `tree-sitter-${language}`,
          `tree-sitter-${language}.wasm`
        );

        // Use glob to find the exact path if the version wildcard doesn't work
        if (!fs.existsSync(wasmPath)) {
          const glob = require('glob');
          const files = glob.sync(path.join(
            extensionPath,
            'node_modules',
            '.pnpm',
            `tree-sitter-${language}@*`,
            'node_modules',
            `tree-sitter-${language}`,
            `tree-sitter-${language}.wasm`
          ));

          if (files.length > 0) {
            wasmPath = files[0];
          }
        }
      }

      // Check if the WASM file exists
      if (!fs.existsSync(wasmPath)) {
        throw new Error(`Language grammar not found: ${wasmPath}. Searched in multiple locations.`);
      }

      console.log(`Found language grammar at: ${wasmPath}`);

      // Load the language
      this.language = await Parser.Language.load(wasmPath);
      if (this.parser && this.language) {
        this.parser.setLanguage(this.language);
        console.log(`Parser initialized for ${language}`);
      }
    } catch (error) {
      console.error(`Failed to initialize parser for ${language}:`, error);
      throw error;
    }
  }

  /**
   * Determine if a file can be parsed by the current parser
   * @param filePath Path to the file to check
   */
  canParseFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext in this.supportedExtensions;
  }

  /**
   * Parse a file to extract code elements (classes, functions)
   * @param filePath Path to the file to parse
   * @param repoId Repository ID for the code elements
   */
  async parseFile(filePath: string, repoId: string): Promise<CodeElement[]> {
    if (!this.parser || !this.language) {
      throw new Error('Parser not initialized');
    }

    try {
      // Read the file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse the file
      const tree = this.parser.parse(content);
      const rootNode = tree.rootNode;

      // Extract code elements
      const codeElements: CodeElement[] = [];

      // Add the file itself as a code element
      const fileElement: CodeElement = {
        elementId: this.generateElementId(repoId, filePath, 'file'),
        repoId,
        type: 'file',
        stableIdentifier: this.getRelativePath(filePath)
      };
      codeElements.push(fileElement);

      // Extract classes and functions
      this.extractCodeElements(rootNode, filePath, repoId, codeElements);

      return codeElements;
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extract code elements from a syntax tree node
   * @param node Syntax tree node
   * @param filePath Path to the file
   * @param repoId Repository ID
   * @param codeElements Array to store extracted code elements
   */
  private extractCodeElements(
    node: Parser.SyntaxNode,
    filePath: string,
    repoId: string,
    codeElements: CodeElement[]
  ): void {
    // Extract classes and functions based on the language
    const ext = path.extname(filePath).toLowerCase();
    const language = this.supportedExtensions[ext];

    if (language === 'typescript') {
      this.extractTypeScriptElements(node, filePath, repoId, codeElements);
    } else if (language === 'python') {
      this.extractPythonElements(node, filePath, repoId, codeElements);
    }
  }

  /**
   * Extract TypeScript code elements
   * @param node Syntax tree node
   * @param filePath Path to the file
   * @param repoId Repository ID
   * @param codeElements Array to store extracted code elements
   */
  private extractTypeScriptElements(
    node: Parser.SyntaxNode,
    filePath: string,
    repoId: string,
    codeElements: CodeElement[]
  ): void {
    // Process current node
    if (node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const className = nameNode.text;
        const stableIdentifier = `${this.getRelativePath(filePath)}:class:${className}`;

        codeElements.push({
          elementId: this.generateElementId(repoId, stableIdentifier, 'class'),
          repoId,
          type: 'class',
          stableIdentifier
        });
      }
    } else if (
      node.type === 'function_declaration' ||
      node.type === 'method_definition'
    ) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const functionName = nameNode.text;
        let stableIdentifier = '';

        if (node.type === 'method_definition') {
          // Find the parent class
          let parent = node.parent;
          while (parent && parent.type !== 'class_declaration') {
            parent = parent.parent;
          }

          if (parent && parent.childForFieldName('name')) {
            const className = parent.childForFieldName('name')!.text;
            stableIdentifier = `${this.getRelativePath(filePath)}:class:${className}:method:${functionName}`;
          } else {
            stableIdentifier = `${this.getRelativePath(filePath)}:method:${functionName}`;
          }
        } else {
          stableIdentifier = `${this.getRelativePath(filePath)}:function:${functionName}`;
        }

        codeElements.push({
          elementId: this.generateElementId(repoId, stableIdentifier, 'function'),
          repoId,
          type: 'function',
          stableIdentifier
        });
      }
    }

    // Process child nodes
    for (let i = 0; i < node.childCount; i++) {
      this.extractTypeScriptElements(node.child(i)!, filePath, repoId, codeElements);
    }
  }

  /**
   * Extract Python code elements
   * @param node Syntax tree node
   * @param filePath Path to the file
   * @param repoId Repository ID
   * @param codeElements Array to store extracted code elements
   */
  private extractPythonElements(
    node: Parser.SyntaxNode,
    filePath: string,
    repoId: string,
    codeElements: CodeElement[]
  ): void {
    // Process current node
    if (node.type === 'class_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const className = nameNode.text;
        const stableIdentifier = `${this.getRelativePath(filePath)}:class:${className}`;

        codeElements.push({
          elementId: this.generateElementId(repoId, stableIdentifier, 'class'),
          repoId,
          type: 'class',
          stableIdentifier
        });
      }
    } else if (node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const functionName = nameNode.text;
        let stableIdentifier = '';

        // Check if this is a method in a class
        let parent = node.parent;
        let isMethod = false;

        while (parent) {
          if (parent.type === 'class_definition') {
            isMethod = true;
            const className = parent.childForFieldName('name')!.text;
            stableIdentifier = `${this.getRelativePath(filePath)}:class:${className}:method:${functionName}`;
            break;
          }
          parent = parent.parent;
        }

        if (!isMethod) {
          stableIdentifier = `${this.getRelativePath(filePath)}:function:${functionName}`;
        }

        codeElements.push({
          elementId: this.generateElementId(repoId, stableIdentifier, 'function'),
          repoId,
          type: 'function',
          stableIdentifier
        });
      }
    }

    // Process child nodes
    for (let i = 0; i < node.childCount; i++) {
      this.extractPythonElements(node.child(i)!, filePath, repoId, codeElements);
    }
  }

  /**
   * Generate a deterministic element ID
   * @param repoId Repository ID
   * @param identifier Stable identifier for the element
   * @param type Type of the element
   */
  private generateElementId(repoId: string, identifier: string, type: string): string {
    return crypto.createHash('sha256').update(`${repoId}:${type}:${identifier}`).digest('hex').substring(0, 16);
  }

  /**
   * Get the relative path of a file within the repository
   * @param filePath Absolute path to the file
   */
  private getRelativePath(filePath: string): string {
    // In a real implementation, we would get the repository root path
    // and calculate the relative path. For simplicity, we'll just use
    // the file name for now.
    return path.basename(filePath);
  }
}
