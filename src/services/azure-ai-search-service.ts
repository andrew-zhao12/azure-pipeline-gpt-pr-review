import { Agent } from 'node:https';
import { AzureAISearchConfig, ImpactAnalysisResult } from '../types/azure-search';
import { AzureAISearchClient } from './azure-ai-search-client';
import { ImpactAnalyzer } from './impact-analyzer';

/**
 * Main service class for Azure AI Search integration and code impact analysis
 * 
 * This service has been refactored into smaller, focused modules:
 * - AzureAISearchClient: Raw search operations
 * - ImpactAnalyzer: Code impact analysis orchestration
 * - DiffParser: Git diff parsing utilities
 * - CodeStructureParser: Code structure analysis
 * - SearchQueryBuilder: Search query optimization
 * - LegacyIdentifierExtractor: Legacy fallback methods
 */
export class AzureAISearchService {
  private client: AzureAISearchClient;
  private analyzer: ImpactAnalyzer;

  constructor(config: AzureAISearchConfig, httpsAgent: Agent) {
    this.client = new AzureAISearchClient(config, httpsAgent);
    this.analyzer = new ImpactAnalyzer(this.client);
  }

  /**
   * Analyzes the impact of code changes by identifying affected methods/classes and searching for their usage
   */
  public async analyzeCodeImpact(
    filePath: string,
    fileDiff: string,
    fileContent: string,
    targetBranch: string
  ): Promise<ImpactAnalysisResult[]> {
    return this.analyzer.analyzeCodeImpact(filePath, fileDiff, fileContent, targetBranch);
  }

  /**
   * Tests connection to Azure AI Search
   */
  public async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  /**
   * Formats impact analysis results for inclusion in review context
   */
  public formatImpactAnalysis(results: ImpactAnalysisResult[]): string {
    return this.analyzer.formatImpactAnalysis(results);
  }
}

// Re-export types for backward compatibility
export { AzureAISearchConfig, CodeReference, ImpactAnalysisResult } from '../types/azure-search';