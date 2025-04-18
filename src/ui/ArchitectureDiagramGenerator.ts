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
    const data = await this.getDiagramData(repoId);
    const { nodes, edges } = data;
    if (nodes.length === 0) {
      return `<div>No code elements found. Have you indexed your repository?</div>`;
    }

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

    // Add style definitions for node types
    definition += 'classDef file fill:#f9f9f9,stroke:#666,stroke-width:1px;\n';
    definition += 'classDef class fill:#e1f5fe,stroke:#0277bd,stroke-width:1px;\n';
    definition += 'classDef function fill:#fff8e1,stroke:#ffa000,stroke-width:1px;\n';
    definition += 'classDef module fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;\n';
    definition += 'classDef decision fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px,stroke-dasharray: 5 5;\n';
    definition += 'classDef hasDecision fill:#f9f,stroke:#333,stroke-width:2px;\n';

    // Group nodes by top-level directory
    const nodesByDir = new Map<string, any[]>();

    for (const node of nodes) {
      // Extract top-level directory from path
      let topDir = 'root';
      if (node.path) {
        const parts = node.path.split('/');
        if (parts.length > 1) {
          topDir = parts[0];
        }
      }

      // Add to group
      if (!nodesByDir.has(topDir)) {
        nodesByDir.set(topDir, []);
      }
      nodesByDir.get(topDir)!.push(node);
    }

    // Add subgraphs for each directory
    let subgraphCounter = 0;
    for (const [dir, dirNodes] of nodesByDir.entries()) {
      // Skip small directories (less than 2 nodes)
      if (dirNodes.length < 2 && dir !== 'root') {
        // Move these nodes to root
        const rootNodes = nodesByDir.get('root') || [];
        nodesByDir.set('root', [...rootNodes, ...dirNodes]);
        continue;
      }

      // Add subgraph
      definition += `  subgraph sg${subgraphCounter}["${dir}"]\n`;

      // Add nodes to subgraph
      for (const node of dirNodes) {
        // Choose shape based on type
        let shape = '';
        switch(node.type) {
          case 'file': shape = '[[]]'; break;
          case 'class': shape = '{{}}'; break;
          case 'function': shape = '()'; break;
          case 'module': shape = '[()]'; break;
          default: shape = '[[]]';
        }

        // Add icon based on type
        const icon = node.type === 'file' ? '📄 ' :
                    node.type === 'class' ? '🧩 ' :
                    node.type === 'function' ? '⚙️ ' :
                    node.type === 'module' ? '📦 ' : '';

        // Add decision indicator if applicable
        const decisionIndicator = node.hasDecisions ? ' ✏️' : '';

        definition += `  ${node.id}${shape}["${icon}${node.label}${decisionIndicator}"];\n`;

        // Apply class based on type and decisions
        definition += `  class ${node.id} ${node.type};\n`;
        if (node.hasDecisions) {
          definition += `  class ${node.id} hasDecision;\n`;
        }
      }

      definition += `  end\n`;
      subgraphCounter++;
    }

    // Add edges
    for (const edge of edges) {
      let arrowType = '-->';
      if (edge.type === 'contains') {
        arrowType = '-->';
      } else if (edge.type === 'uses') {
        arrowType = '-.->';
      } else if (edge.type === 'extends') {
        arrowType = '==>';
      }

      definition += `  ${edge.source} ${arrowType} ${edge.target};\n`;
    }

    return definition;
  }
}
