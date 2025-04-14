/**
 * Interface for generating architecture diagrams
 */
export interface IArchitectureDiagramGenerator {
  /**
   * Generate a simple architecture diagram for a repository
   * @param repoId Repository ID
   * @returns HTML/SVG content for the diagram
   */
  generateDiagram(repoId: string): Promise<string>;
  
  /**
   * Get the data needed for diagram generation
   * @param repoId Repository ID
   */
  getDiagramData(repoId: string): Promise<any>;
}
