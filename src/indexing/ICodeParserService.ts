import { CodeElement } from '../models/types';

/**
 * Interface for code parsing using tree-sitter
 */
export interface ICodeParserService {
  /**
   * Parse a file to extract code elements (classes, functions)
   * @param filePath Path to the file to parse
   * @param repoId Repository ID for the code elements
   */
  parseFile(filePath: string, repoId: string): Promise<CodeElement[]>;
  
  /**
   * Initialize the parser with the appropriate language
   * @param language Programming language to use ('typescript' | 'python')
   */
  initializeParser(language: 'typescript' | 'python'): Promise<void>;
  
  /**
   * Determine if a file can be parsed by the current parser
   * @param filePath Path to the file to check
   */
  canParseFile(filePath: string): boolean;
}
