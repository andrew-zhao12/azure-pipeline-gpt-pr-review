export interface AzureAISearchConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  indexName: string;
}

export interface CodeReference {
  filepath: string;
  content: string;
  title: string;
  startLine: number;
  endLine: number;
  branch: string;
  language: string;
  score: number;
  highlights?: string[];
}

export interface ImpactAnalysisResult {
  identifier: string;
  type: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component';
  references: CodeReference[];
  totalReferences: number;
}

export interface CodeElement {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type';
  startLine: number;
  endLine: number;
}

export interface ComponentElement {
  name: string;
  type: 'component';
  startLine: number;
  endLine: number;
}

export interface SearchBody {
  search: string;
  select?: string;
  top?: number;
  highlight?: string;
  filter?: string;
}