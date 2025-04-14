import { IArchitectureDiagramGenerator } from './IArchitectureDiagramGenerator';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';

/**
 * Implementation of IArchitectureDiagramGenerator using Mermaid.js
 */
export class ArchitectureDiagramGenerator implements IArchitectureDiagramGenerator {
  constructor(private knowledgeGraphService: IKnowledgeGraphService) {}

  /**
   * Generate a simple architecture diagram for a repository
   * @param repoId Repository ID
   * @returns HTML/SVG content for the diagram
   */
  async generateDiagram(repoId: string): Promise<string> {
    // Get the diagram data from the knowledge graph
    const data = await this.getDiagramData(repoId);
    
    // Generate a Mermaid.js diagram definition
    const mermaidDefinition = this.generateMermaidDefinition(data);
    
    // Return the HTML that will render the diagram
    return `
      <div class="mermaid">
        ${mermaidDefinition}
      </div>
      <script>
        // This script will be executed in the webview context
        // The VS Code extension will need to include the Mermaid.js library
        if (typeof mermaid !== 'undefined') {
          mermaid.initialize({
            startOnLoad: true,
            theme: 'neutral',
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: 'basis'
            }
          });
          mermaid.run();
        }
      </script>
    `;
  }

  /**
   * Get the data needed for diagram generation
   * @param repoId Repository ID
   */
  async getDiagramData(repoId: string): Promise<any> {
    return this.knowledgeGraphService.getArchitectureDiagramData(repoId);
  }

  /**
   * Generate a Mermaid.js diagram definition
   * @param data Diagram data from the knowledge graph
   */
  private generateMermaidDefinition(data: any): string {
    const { nodes, edges } = data;
    
    // Start with a flowchart definition
    let definition = 'graph TD;\n';
    
    // Add nodes
    for (const node of nodes) {
      const shape = node.type === 'file' ? '[[]]' : '{{}}';
      definition += `  ${node.id}${shape}["${node.label}"];\n`;
    }
    
    // Add edges
    for (const edge of edges) {
      const arrowType = edge.type === 'contains' ? '-->' : '-.->'; // Solid for contains, dashed for other relationships
      definition += `  ${edge.source} ${arrowType} ${edge.target};\n`;
    }
    
    return definition;
  }
}
