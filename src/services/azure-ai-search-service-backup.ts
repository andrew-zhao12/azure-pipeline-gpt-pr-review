import fetch from 'node-fetch';
import { Agent } from 'node:https';

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
  type: 'function' | 'class' | 'variable' | 'interface' | 'type';
  references: CodeReference[];
  totalReferences: number;
}

export class AzureAISearchService {
  private config: AzureAISearchConfig;
  private httpsAgent: Agent;

  constructor(config: AzureAISearchConfig, httpsAgent: Agent) {
    this.config = config;
    this.httpsAgent = httpsAgent;
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
      const affectedLines = this.getAffectedLinesFromDiff(fileDiff);
      console.log(`📝 Found ${affectedLines.length} affected lines: ${affectedLines.slice(0, 5).join(', ')}${affectedLines.length > 5 ? '...' : ''}`);

      if (affectedLines.length === 0) {
        console.log(`ℹ️ No affected lines found in diff`);
        return [];
      }

      // Parse file structure to identify methods and classes
      const codeStructure = this.parseCodeStructure(fileContent);
      console.log(`🏗️ Parsed ${codeStructure.length} code elements (methods/classes)`);

      // Find which methods/classes are affected by the changes
      const affectedElements = this.findAffectedCodeElements(affectedLines, codeStructure);
      console.log(`🎯 Found ${affectedElements.length} affected code elements: ${affectedElements.map(e => `${e.name} (${e.type})`).join(', ')}`);

      const results: ImpactAnalysisResult[] = [];

      // Search for usage of each affected method/class
      for (const element of affectedElements) {
        console.log(`🔍 Searching for usage of ${element.type}: ${element.name}`);
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
          } else {
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
  ): Promise<CodeReference[]> {
    console.log(`🔍 Starting search for identifier: ${identifier} (type: ${type})`);
    try {
      // Build search query with proper escaping
      console.log(`🔧 Building search query for: ${identifier} in ${excludeFilePath}`);
      const searchQuery = this.buildSearchQuery(identifier, type);
      console.log(`🔎 Search query for ${identifier}: ${searchQuery}`);
      
      const searchBody = {
        search: searchQuery,
        select: 'filepath,content,title,startLine,endLine,branch,language',
        top: 50,
        highlight: 'content,title',
        filter: `filepath ne '${excludeFilePath.replace(/'/g, "''")}'`, // Exclude the file being changed
      };

      const url = `${this.config.endpoint}/indexes/${this.config.indexName}/docs/search?api-version=${this.config.apiVersion}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(searchBody),
        agent: this.httpsAgent
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Azure AI Search error details:`, {
          status: response.status,
          statusText: response.statusText,
          identifier: identifier,
          query: searchQuery,
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
        branch: result.branch || '',
        language: result.language || '',
        score: result['@search.score'] || 0,
        highlights: [...(result['@search.highlights']?.content || []), ...(result['@search.highlights']?.title || [])]
      })) || [];

    } catch (error) {
      console.error(`❌ Error searching for ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Builds an optimized search query for the identifier
   */
  private buildSearchQuery(identifier: string, type: string): string {
    console.log(`🔧 buildSearchQuery called with identifier: "${identifier}", type: "${type}"`);
    
    try {
      // Escape special characters for Azure Search
      const escapedIdentifier = identifier.replace(/[\+\-&|!\(\)\{\}\[\]\^\"~\*\?:\\\/]/g, '\\$&');
      console.log(`🔒 Escaped identifier: "${escapedIdentifier}"`);
      
      // Use simple search syntax instead of field-specific syntax
      let query: string;
      switch (type) {
        case 'function':
          query = `"${escapedIdentifier}(" OR "${escapedIdentifier} =" OR "function ${escapedIdentifier}" OR ".${escapedIdentifier}(" OR "await ${escapedIdentifier}("`;
          break;
        case 'class':
          query = `"class ${escapedIdentifier}" OR "extends ${escapedIdentifier}" OR "new ${escapedIdentifier}" OR "instanceof ${escapedIdentifier}" OR ": ${escapedIdentifier}"`;
          break;
        case 'interface':
        case 'type':
          query = `"interface ${escapedIdentifier}" OR "type ${escapedIdentifier}" OR "implements ${escapedIdentifier}" OR ": ${escapedIdentifier}" OR "as ${escapedIdentifier}"`;
          break;
        case 'variable':
          query = `"${escapedIdentifier}" OR ".${escapedIdentifier}" OR "${escapedIdentifier}."`;
          break;
        default:
          query = `"${escapedIdentifier}"`;
          break;
      }
      
      console.log(`✅ Built query: "${query}"`);
      return query;
    } catch (error) {
      console.error(`❌ Error in buildSearchQuery for identifier "${identifier}":`, error);
      throw error;
    }
  }

  /**
   * Gets the line numbers that were affected by the diff (added or modified lines)
   */
  private getAffectedLinesFromDiff(fileDiff: string): number[] {
    const affectedLines: number[] = [];
    const lines = fileDiff.split('\n');
    let newLineNumber = 0;
    let inHunk = false;

    for (const line of lines) {
      // Parse hunk headers like @@ -1,4 +1,6 @@
      if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (hunkMatch) {
          newLineNumber = parseInt(hunkMatch[1], 10);
          inHunk = true;
          continue;
        }
      }

      if (!inHunk) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        // This is an added line
        affectedLines.push(newLineNumber);
        newLineNumber++;
      } else if (line.startsWith(' ')) {
        // This is a context line
        newLineNumber++;
      }
      // Removed lines (starting with '-') don't increment newLineNumber
    }

    return affectedLines.sort((a, b) => a - b);
  }

  /**
   * Parses the file content to identify code structure (methods, classes, etc.)
   */
  private parseCodeStructure(fileContent: string): Array<{name: string, type: 'function' | 'class' | 'interface' | 'type', startLine: number, endLine: number}> {
    const elements: Array<{name: string, type: 'function' | 'class' | 'interface' | 'type', startLine: number, endLine: number}> = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip comments and empty lines
      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
        continue;
      }

      // Match class declarations
      let match = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/i);
      if (match && !line.match(/^\s*(if|while|for)\s*\(/i)) { // Ensure it's not inside a control structure
        const endLine = this.findBlockEnd(lines, i);
        elements.push({
          name: match[1],
          type: 'class',
          startLine: lineNumber,
          endLine: endLine
        });
        continue;
      }

      // Match interface declarations
      match = line.match(/(?:export\s+)?interface\s+(\w+)/i);
      if (match && !line.match(/^\s*(if|while|for)\s*\(/i)) { // Ensure it's not inside a control structure
        const endLine = this.findBlockEnd(lines, i);
        elements.push({
          name: match[1],
          type: 'interface',
          startLine: lineNumber,
          endLine: endLine
        });
        continue;
      }

      // Match type declarations
      match = line.match(/(?:export\s+)?type\s+(\w+)/i);
      if (match && 
          !line.match(/^\s*(if|while|for)\s*\(/i) && // Ensure it's not inside a control structure
          !line.match(/typeof\s+/i)) { // Exclude typeof expressions
        elements.push({
          name: match[1],
          type: 'type',
          startLine: lineNumber,
          endLine: lineNumber // Types are usually single line
        });
        continue;
      }

      // Match function declarations (including methods)
      match = line.match(/(?:export\s+)?(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*\(/i);
      if (match) {
        const functionName = match[1];
        
        // Check all exclusion criteria
        const isControlStructure = line.match(/^\s*(if|else\s*if|for|while|do|foreach|switch|catch|finally|using|try|with|return|throw|yield|await)\s*[\(\{]?/i);
        const isAssignment = line.match(/^\s*\w+\s*=\s*\(/i);
        const isConstructorCall = line.match(/^\s*new\s+\w+\s*\(/i);
        const isMethodCall = line.match(/^\s*\w+\.\w+\s*\(/i);
        const isDynamicCall = line.match(/^\s*\w+\[\w+\]\s*\(/i);
        const isArrowFunction = line.match(/^\s*\(\s*\w+\s*\)\s*=>|^\s*\w+\s*=>\s*/i);
        const isChainedCall = line.match(/^\s*\.\w+\s*\(/i);
        const isOptionalChaining = line.match(/^\s*\w+\?\.\w+\s*\(/i);
        
        if (!isControlStructure && !isAssignment && !isConstructorCall && !isMethodCall && 
            !isDynamicCall && !isArrowFunction && !isChainedCall && !isOptionalChaining) {
          
          const endLine = this.findBlockEnd(lines, i);
          elements.push({
            name: functionName,
            type: 'function',
            startLine: lineNumber,
            endLine: endLine
          });
          console.log(`🔍 Detected function: ${functionName} (lines ${lineNumber}-${endLine})`);
        } else {
          console.log(`⏭️  Skipped non-function: ${functionName} - ${line.substring(0, 50)}...`);
        }
      }
    }

    return elements;
  }

  /**
   * Finds the end line of a code block starting at the given line index
   */
  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1; // +1 because line numbers are 1-based
          }
        }
      }
    }

    // If no closing brace found, assume it's a single line
    return startIndex + 1;
  }

  /**
   * Finds which code elements (methods/classes) contain the affected lines
   */
  private findAffectedCodeElements(
    affectedLines: number[], 
    codeStructure: Array<{name: string, type: 'function' | 'class' | 'interface' | 'type', startLine: number, endLine: number}>
  ): Array<{name: string, type: 'function' | 'class' | 'interface' | 'type'}> {
    const affectedElements: Array<{name: string, type: 'function' | 'class' | 'interface' | 'type'}> = [];
    const seen = new Set<string>();

    for (const line of affectedLines) {
      for (const element of codeStructure) {
        if (line >= element.startLine && line <= element.endLine) {
          const key = `${element.type}:${element.name}`;
          if (!seen.has(key)) {
            affectedElements.push({
              name: element.name,
              type: element.type
            });
            seen.add(key);
            console.log(`📍 Line ${line} affects ${element.type} '${element.name}' (lines ${element.startLine}-${element.endLine})`);
          }
        }
      }
    }

    // If no specific elements found, try to extract meaningful identifiers from the actual changed lines
    if (affectedElements.length === 0) {
      console.log(`⚠️ No specific code elements found, falling back to basic identifier extraction`);
      // This could be a fallback to the old method for edge cases
    }

    return affectedElements;
  }

  /**
   * Legacy method - kept for reference but no longer used in main flow
   * Extracts identifiers from diff and file content
   */
  private extractIdentifiersFromDiff(fileDiff: string, fileContent: string): Array<{name: string, type: 'function' | 'class' | 'variable' | 'interface' | 'type'}> {
    const identifiers: Array<{name: string, type: 'function' | 'class' | 'variable' | 'interface' | 'type'}> = [];
    const seen = new Set<string>();

    // Filter out JavaScript/TypeScript reserved keywords and common false positives
    const reservedWords = new Set([
      'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'function', 'return', 'var', 'let', 'const',
      'class', 'extends', 'implements', 'interface', 'type', 'enum', 'namespace', 'module', 'import', 'export',
      'default', 'public', 'private', 'protected', 'static', 'readonly', 'abstract', 'async', 'await',
      'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'typeof', 'instanceof', 'in', 'of',
      'true', 'false', 'null', 'undefined', 'void', 'never', 'any', 'unknown', 'string', 'number', 'boolean',
      'object', 'symbol', 'bigint', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
      'Error', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Proxy', 'Reflect', 'JSON', 'Math', 'console',
      'foreach', 'switch', 'case', 'with', 'delete', 'debugger', 'yield', 'package', 'goto', 'implements',
      'interface', 'let', 'private', 'public', 'yield', 'static', 'enum', 'export', 'extends', 'import',
      'super', 'implements', 'interface', 'let', 'package', 'private', 'protected', 'public', 'static',
      'yield', 'null', 'true', 'false', 'unknown', 'any', 'void', 'never', 'readonly', 'unique', 'symbol',
      'keyof', 'infer', 'is'
    ]);

    // Helper function to check if identifier is meaningful
    const isValidIdentifier = (name: string): boolean => {
      // Must be longer than 1 character for meaningful analysis
      if (name.length <= 1) return false;
      // Skip reserved words
      if (reservedWords.has(name.toLowerCase())) return false;
      // Skip common single letters and short meaningless terms
      if (/^[a-z]$|^[A-Z]$|^\d+$/.test(name)) return false;
      // Must contain at least one letter
      if (!/[a-zA-Z]/.test(name)) return false;
      return true;
    };

    // Extract added/modified lines from diff
    const addedLines = fileDiff
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1).trim());

    const allLines = [...addedLines, ...fileContent.split('\n')];

    for (const line of allLines) {
      // Extract function definitions
      const functionMatches = line.match(/(?:function|async\s+function|const\s+\w+\s*=\s*(?:async\s+)?\(|export\s+(?:async\s+)?function)\s+(\w+)/g);
      if (functionMatches) {
        functionMatches.forEach(match => {
          const name = match.match(/(\w+)/)?.[1];
          if (name && !seen.has(`function:${name}`) && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'function' });
            seen.add(`function:${name}`);
          }
        });
      }

      // Extract class definitions
      const classMatches = line.match(/(?:class|export\s+class)\s+(\w+)/g);
      if (classMatches) {
        classMatches.forEach(match => {
          const name = match.match(/class\s+(\w+)/)?.[1];
          if (name && !seen.has(`class:${name}`) && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'class' });
            seen.add(`class:${name}`);
          }
        });
      }

      // Extract interface definitions
      const interfaceMatches = line.match(/(?:interface|export\s+interface)\s+(\w+)/g);
      if (interfaceMatches) {
        interfaceMatches.forEach(match => {
          const name = match.match(/interface\s+(\w+)/)?.[1];
          if (name && !seen.has(`interface:${name}`) && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'interface' });
            seen.add(`interface:${name}`);
          }
        });
      }

      // Extract type definitions
      const typeMatches = line.match(/(?:type|export\s+type)\s+(\w+)/g);
      if (typeMatches) {
        typeMatches.forEach(match => {
          const name = match.match(/type\s+(\w+)/)?.[1];
          if (name && !seen.has(`type:${name}`) && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'type' });
            seen.add(`type:${name}`);
          }
        });
      }

      // Extract variable/const definitions (exported ones)
      const variableMatches = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/g);
      if (variableMatches) {
        variableMatches.forEach(match => {
          const name = match.match(/(?:const|let|var)\s+(\w+)/)?.[1];
          if (name && !seen.has(`variable:${name}`) && line.includes('export') && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'variable' });
            seen.add(`variable:${name}`);
          }
        });
      }

      // Extract method definitions in classes
      const methodMatches = line.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/g);
      if (methodMatches && (line.includes('public') || line.includes('private') || line.includes('protected') || line.trim().match(/^\w+\s*\(/))) {
        methodMatches.forEach(match => {
          const name = match.match(/(\w+)\s*\(/)?.[1];
          if (name && name !== 'constructor' && !seen.has(`function:${name}`) && isValidIdentifier(name)) {
            identifiers.push({ name, type: 'function' });
            seen.add(`function:${name}`);
          }
        });
      }
    }

    return identifiers;
  }

  /**
   * Truncates content to specified length with ellipsis
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Tests connection to Azure AI Search
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config.endpoint}/indexes/${this.config.indexName}?api-version=${this.config.apiVersion}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'api-key': this.config.apiKey
        },
        agent: this.httpsAgent
      });

      if (response.ok) {
        console.log('✅ Azure AI Search connection successful');
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