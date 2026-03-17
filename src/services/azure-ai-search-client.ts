import { Agent } from 'node:https';
import { AzureAISearchConfig, CodeReference, SearchBody } from '../types/azure-search';
import { fetch } from 'undici';

/**
 * Core Azure AI Search client for handling raw search operations
 */
export class AzureAISearchClient {
  private config: AzureAISearchConfig;
  private httpsAgent: Agent;

  constructor(config: AzureAISearchConfig, httpsAgent: Agent) {
    this.config = config;
    this.httpsAgent = httpsAgent;
  }

  /**
   * Executes a search query against Azure AI Search
   */
  public async search(searchBody: SearchBody): Promise<CodeReference[]> {
    try {
      const url = `${this.config.endpoint}/indexes/${this.config.indexName}/docs/search?api-version=${this.config.apiVersion}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Azure AI Search error details:`, {
          status: response.status,
          statusText: response.statusText,
          query: searchBody.search,
          errorBody: errorText
        });
        throw new Error(`Azure AI Search request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const searchResults = await response.json() as any;
      
      return searchResults.value?.map((result: any) => ({
        filepath: result.filepath || 'unknown',
        content: this.truncateContent(result.content || '', 500),
        title: result.title || '',
        startLine: result.startLine || 0,
        endLine: result.endLine || 0,
        branch: result.branch || 'main',
        language: result.language || 'unknown',
        score: result['@search.score'] || 0,
        highlights: [...(result['@search.highlights']?.content || []), ...(result['@search.highlights']?.title || [])]
      })) || [];

    } catch (error) {
      console.error(`❌ Error executing search:`, error);
      return [];
    }
  }

  /**
   * Tests connection to Azure AI Search
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config.endpoint}/indexes/${this.config.indexName}?api-version=${this.config.apiVersion}`;
      
      const response = await fetch(url, {
        headers: {
          'api-key': this.config.apiKey
        }
      });

      if (response.ok) {
        console.log(`✅ Azure AI Search connection successful`);
        return true;
      } else {
        console.error(`❌ Azure AI Search connection failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Azure AI Search connection error:', error);
      return false;
    }
  }

  /**
   * Truncates content to specified length with ellipsis
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
}