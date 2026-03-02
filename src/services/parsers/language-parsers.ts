import { CodeElement } from '../../types/azure-search';

/**
 * Language-specific parsing strategies for different file types
 */
export interface LanguageParser {
  /**
   * Parses code content specific to the language/file type
   */
  parseCodeStructure(fileContent: string, filePath: string): CodeElement[];
  
  /**
   * Gets the primary identifier(s) that should be searched for this file type
   */
  getPrimaryIdentifiers(filePath: string, affectedLines: number[], codeStructure: CodeElement[]): Array<{name: string, type: 'function' | 'class' | 'interface' | 'type' | 'component'}>;
}

/**
 * C# file parser - focuses on classes and methods
 */
export class CSharpParser implements LanguageParser {
  parseCodeStructure(fileContent: string, filePath: string): CodeElement[] {
    const elements: CodeElement[] = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip comments and empty lines
      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
        continue;
      }

      // Match class declarations
      let match = line.match(/(?:public|private|protected|internal)?\s*(?:static|abstract|sealed|partial)?\s*class\s+(\w+)/i);
      if (match) {
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
      match = line.match(/(?:public|private|protected|internal)?\s*interface\s+(\w+)/i);
      if (match) {
        const endLine = this.findBlockEnd(lines, i);
        elements.push({
          name: match[1],
          type: 'interface',
          startLine: lineNumber,
          endLine: endLine
        });
        continue;
      }

      // Match method declarations (including constructors)
      match = line.match(/(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async)?\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?:where\s+.*?)?\s*[{;]/i);
      if (match) {
        const methodName = match[1];
        
        // Skip property accessors and common keywords
        const skipKeywords = ['get', 'set', 'add', 'remove', 'if', 'while', 'for', 'foreach', 'switch', 'using', 'try', 'catch'];
        if (!skipKeywords.includes(methodName.toLowerCase())) {
          const endLine = line.includes(';') ? lineNumber : this.findBlockEnd(lines, i);
          elements.push({
            name: methodName,
            type: 'function',
            startLine: lineNumber,
            endLine: endLine
          });
        }
      }
    }

    return elements;
  }

  getPrimaryIdentifiers(filePath: string, affectedLines: number[], codeStructure: CodeElement[]) {
    const identifiers: Array<{name: string, type: 'function' | 'class' | 'interface' | 'type' | 'component'}> = [];
    const seen = new Set<string>();

    // Find affected methods and their containing classes
    for (const line of affectedLines) {
      // Find the method containing this line
      const affectedMethod = codeStructure.find(e => 
        e.type === 'function' && line >= e.startLine && line <= e.endLine
      );
      
      if (affectedMethod && !seen.has(`method:${affectedMethod.name}`)) {
        identifiers.push({ name: affectedMethod.name, type: 'function' });
        seen.add(`method:${affectedMethod.name}`);
      }

      // Find the class containing this line
      const containingClass = codeStructure.find(e => 
        e.type === 'class' && line >= e.startLine && line <= e.endLine
      );
      
      if (containingClass && !seen.has(`class:${containingClass.name}`)) {
        identifiers.push({ name: containingClass.name, type: 'class' });
        seen.add(`class:${containingClass.name}`);
      }
    }

    return identifiers;
  }

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
            return i + 1;
          }
        }
      }
    }

    return startIndex + 1;
  }
}

/**
 * Razor file parser - treats the entire file as a single component
 */
export class RazorParser implements LanguageParser {
  parseCodeStructure(fileContent: string, filePath: string): CodeElement[] {
    // For Razor files, the entire file is one component
    const componentName = this.getComponentName(filePath);
    const lines = fileContent.split('\n');
    
    return [{
      name: componentName,
      type: 'class', // Razor components are essentially classes
      startLine: 1,
      endLine: lines.length
    }];
  }

  getPrimaryIdentifiers(filePath: string, affectedLines: number[], codeStructure: CodeElement[]) {
    // For Razor files, always search for the component name
    const componentName = this.getComponentName(filePath);
    
    return [{
      name: componentName,
      type: 'component' as const
    }];
  }

  private getComponentName(filePath: string): string {
    // Extract component name from file path (e.g., "Components/MyComponent.razor" -> "MyComponent")
    const fileName = filePath.split(/[\\/]/).pop() || '';
    return fileName.replace(/\.(razor|cshtml)$/i, '');
  }
}

/**
 * TypeScript/JavaScript file parser
 */
export class TypeScriptParser implements LanguageParser {
  parseCodeStructure(fileContent: string, filePath: string): CodeElement[] {
    const elements: CodeElement[] = [];
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
      if (match) {
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
      if (match) {
        const endLine = this.findBlockEnd(lines, i);
        elements.push({
          name: match[1],
          type: 'interface',
          startLine: lineNumber,
          endLine: endLine
        });
        continue;
      }

      // Match function declarations
      match = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/i);
      if (match) {
        const endLine = this.findBlockEnd(lines, i);
        elements.push({
          name: match[1],
          type: 'function',
          startLine: lineNumber,
          endLine: endLine
        });
        continue;
      }

      // Match method declarations
      match = line.match(/(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/i);
      if (match) {
        const methodName = match[1];
        const reservedWords = ['if', 'for', 'while', 'switch', 'try', 'catch', 'with'];
        
        if (!reservedWords.includes(methodName.toLowerCase())) {
          const endLine = this.findBlockEnd(lines, i);
          elements.push({
            name: methodName,
            type: 'function',
            startLine: lineNumber,
            endLine: endLine
          });
        }
      }
    }

    return elements;
  }

  getPrimaryIdentifiers(filePath: string, affectedLines: number[], codeStructure: CodeElement[]) {
    const identifiers: Array<{name: string, type: 'function' | 'class' | 'interface' | 'type' | 'component'}> = [];
    const seen = new Set<string>();

    for (const line of affectedLines) {
      for (const element of codeStructure) {
        if (line >= element.startLine && line <= element.endLine) {
          const key = `${element.type}:${element.name}`;
          if (!seen.has(key)) {
            identifiers.push({ name: element.name, type: element.type });
            seen.add(key);
          }
        }
      }
    }

    return identifiers;
  }

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
            return i + 1;
          }
        }
      }
    }

    return startIndex + 1;
  }
}

/**
 * Factory to get the appropriate parser for a file type
 */
export class LanguageParserFactory {
  static getParser(filePath: string): LanguageParser {
    const extension = filePath.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'cs':
        return new CSharpParser();
      
      case 'razor':
      case 'cshtml':
        return new RazorParser();
      
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return new TypeScriptParser();
      
      default:
        // Fall back to TypeScript parser for unknown types
        return new TypeScriptParser();
    }
  }

  static getSupportedExtensions(): string[] {
    return ['cs', 'razor', 'cshtml', 'ts', 'tsx', 'js', 'jsx'];
  }
}