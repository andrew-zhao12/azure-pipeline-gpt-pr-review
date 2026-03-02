import { ImpactAnalysisResult } from '../types/azure-search';
import { AzureAISearchClient } from './azure-ai-search-client';
import { DiffParser } from './parsers/diff-parser';
import { CodeStructureParser } from './parsers/code-structure-parser';
import { SearchQueryBuilder } from './parsers/query-builder';

/**
 * Orchestrates code impact analysis using various parsers and Azure AI Search
 */
export class ImpactAnalyzer {
  private searchClient: AzureAISearchClient;

  constructor(searchClient: AzureAISearchClient) {
    this.searchClient = searchClient;
  }

  /**
   * Analyzes the impact of code changes by identifying affected methods/classes and searching for their usage
   */
  public async analyzeCodeImpact(
    filePath: string,
    fileDiff: string,
    fileContent: string
  ): Promise<ImpactAnalysisResult[]> {
    try {
      console.log(`🔍 Analyzing code impact for: ${filePath}`);

      // Parse diff to get affected line numbers
      const affectedLines = DiffParser.getAffectedLinesFromDiff(fileDiff);
      console.log(`📝 Found ${affectedLines.length} affected lines: ${affectedLines.slice(0, 5).join(', ')}${affectedLines.length > 5 ? '...' : ''}`);

      if (affectedLines.length === 0) {
        console.log(`ℹ️ No affected lines found in diff`);
        return [];
      }

      // Parse file structure to identify methods and classes using language-specific rules
      const codeStructure = CodeStructureParser.parseCodeStructure(fileContent, filePath);
      console.log(`🏗️ Parsed ${codeStructure.length} code elements`);

      // Find which methods/classes are affected by the changes using language-specific logic
      const affectedElements = CodeStructureParser.getPrimaryIdentifiers(filePath, affectedLines, codeStructure);
      console.log(`🎯 Found ${affectedElements.length} affected code elements: ${affectedElements.map(e => `${e.name} (${e.type})`).join(', ')}`);

      const results: ImpactAnalysisResult[] = [];

      // Search for usage of each affected method/class
      for (const element of affectedElements) {
        // Only log searches for significant elements
        if (results.length < 3) {
          console.log(`🔍 Searching for usage of ${element.type}: ${element.name}`);
        }
        try {
          const references = await this.searchForIdentifier(element.name, element.type, filePath);
          
          if (references.length > 0) {
            results.push({
              identifier: element.name,
              type: element.type,
              references: references.slice(0, 10), // Limit to top 10 references
              totalReferences: references.length
            });
            console.log(`✅ Found ${references.length} references for ${element.type} '${element.name}'`);
          } else if (results.length < 3) {
            console.log(`ℹ️ No references found for ${element.type} '${element.name}'`);
          }
        } catch (error) {
          console.error(`❌ Failed to search for ${element.type} '${element.name}':`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error analyzing code impact:', error);
      return [];
    }
  }

  /**
   * Searches for a specific identifier in the codebase index
   */
  private async searchForIdentifier(
    identifier: string,
    type: string,
    excludeFilePath: string
  ) {
    // Reduce search logging verbosity
    if (identifier.length <= 3) {
      console.log(`🔍 Starting search for identifier: ${identifier} (type: ${type})`);
    }
    
    try {
      const searchBody = SearchQueryBuilder.buildSearchBody(identifier, type, excludeFilePath);
      // Only log queries for short identifiers to reduce noise
      if (identifier.length <= 3) {
        console.log(`🔎 Search query for ${identifier}: ${searchBody.search}`);
      }
      return await this.searchClient.search(searchBody);

    } catch (error) {
      console.error(`❌ Error searching for ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Formats impact analysis results for inclusion in review context
   */
  public formatImpactAnalysis(results: ImpactAnalysisResult[]): string {
    if (results.length === 0) {
      return '';
    }

    let formatted = '\n\n## 🔗 Codebase Impact Analysis\n\n';
    formatted += 'The following analysis shows where your changes might impact other parts of the codebase:\n\n';

    for (const result of results) {
      formatted += `### ${result.type.toUpperCase()}: \`${result.identifier}\`\n`;
      formatted += `Found ${result.totalReferences} reference(s) across the codebase:\n\n`;

      for (const ref of result.references.slice(0, 5)) { // Show top 5 references
        const lineInfo = ref.startLine && ref.endLine ? ` (Lines ${ref.startLine}-${ref.endLine})` : '';
        const languageInfo = ref.language ? ` [${ref.language}]` : '';
        formatted += `- **${ref.filepath}**${lineInfo}${languageInfo} (Score: ${ref.score.toFixed(2)})\n`;
        
        if (ref.title && ref.title.trim()) {
          formatted += `  - Title: ${ref.title}\n`;
        }
        
        if (ref.highlights && ref.highlights.length > 0) {
          formatted += `  - ${ref.highlights[0].replace(/<\/?em>/g, '**')}\n`;
        } else {
          const contentPreview = ref.content.split('\n')[0].trim();
          if (contentPreview) {
            formatted += `  - ${contentPreview}\n`;
          }
        }
      }

      if (result.totalReferences > 5) {
        formatted += `  - ... and ${result.totalReferences - 5} more reference(s)\n`;
      }
      formatted += '\n';
    }

    formatted += '*Consider reviewing these files to ensure your changes don\'t introduce breaking changes.*\n';
    return formatted;
  }
}