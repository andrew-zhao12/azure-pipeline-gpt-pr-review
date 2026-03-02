import { CodeElement } from '../../types/azure-search';
import { LanguageParserFactory } from './language-parsers';

/**
 * Parses code content to identify structure using language-specific parsers
 */
export class CodeStructureParser {
  /**
   * Parses the file content to identify code structure using language-specific rules
   */
  public static parseCodeStructure(fileContent: string, filePath?: string): CodeElement[] {
    if (filePath) {
      // Use language-specific parser if file path is available
      const parser = LanguageParserFactory.getParser(filePath);
      const elements = parser.parseCodeStructure(fileContent, filePath);
      
      console.log(`🔍 Language-specific parse for ${this.getFileType(filePath)}: found ${elements.length} elements`);
      return elements;
    } else {
      // Fall back to generic parsing if no file path
      console.log(`⚠️ No file path provided, using generic parsing`);
      return this.parseCodeStructureGeneric(fileContent);
    }
  }

  /**
   * Gets primary identifiers to search for based on file type and affected lines
   */
  public static getPrimaryIdentifiers(
    filePath: string,
    affectedLines: number[], 
    codeStructure: CodeElement[]
  ): Array<{name: string, type: 'function' | 'class' | 'interface' | 'type' | 'component'}> {
    const parser = LanguageParserFactory.getParser(filePath);
    const identifiers = parser.getPrimaryIdentifiers(filePath, affectedLines, codeStructure);
    
    console.log(`🎯 ${this.getFileType(filePath)} identifiers: ${identifiers.map(i => `${i.name} (${i.type})`).join(', ')}`);
    return identifiers;
  }

  /**
   * Legacy: Finds which code elements (methods/classes) contain the affected lines
   * Now delegates to language-specific getPrimaryIdentifiers
   */
  public static findAffectedCodeElements(
    affectedLines: number[], 
    codeStructure: CodeElement[],
    filePath?: string
  ): Array<{name: string, type: 'function' | 'class' | 'interface' | 'type'}> {
    
    if (filePath) {
      // Use language-specific logic
      const identifiers = this.getPrimaryIdentifiers(filePath, affectedLines, codeStructure);
      // Filter out component type for backward compatibility
      return identifiers
        .filter(i => i.type !== 'component')
        .map(i => ({ name: i.name, type: i.type as 'function' | 'class' | 'interface' | 'type' }));
    } else {
      // Fall back to generic logic
      return this.findAffectedCodeElementsGeneric(affectedLines, codeStructure);
    }
  }

  /**
   * Generic parsing method (used as fallback when no file path available)
   */
  private static parseCodeStructureGeneric(fileContent: string): CodeElement[] {
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
      if (match && !line.match(/^\s*(if|while|for)\s*\(/i)) {
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
      if (match && !line.match(/^\s*(if|while|for)\s*\(/i)) {
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
          !line.match(/^\s*(if|while|for)\s*\(/i) &&
          !line.match(/typeof\s+/i)) {
        elements.push({
          name: match[1],
          type: 'type',
          startLine: lineNumber,
          endLine: lineNumber
        });
        continue;
      }

      // Match function declarations
      match = line.match(/(?:export\s+)?(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*\(/i);
      if (match) {
        const functionName = match[1];
        
        // Reserved words that should never be considered functions
        const reservedWords = new Set([
          'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', 'finally', 'try', 'with',
          'return', 'throw', 'yield', 'await', 'break', 'continue', 'typeof', 'instanceof',
          'var', 'let', 'const', 'function', 'class', 'interface', 'type', 'enum', 'namespace',
          'import', 'export', 'default', 'new', 'this', 'super', 'true', 'false', 'null', 
          'undefined', 'void', 'delete', 'debugger'
        ]);
        
        // Skip if it's a reserved word
        if (reservedWords.has(functionName.toLowerCase())) {
          continue;
        }
        
        // Check all exclusion criteria
        const isControlStructure = line.match(/\b(if|else|for|while|do|foreach|switch|catch|finally|using|try|with|return|throw|yield|await)\s*[\(\{]/i);
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
          // Only log significant functions, not every detection
          if (elements.length <= 10) {
            console.log(`🔍 Detected function: ${functionName} (lines ${lineNumber}-${endLine})`);
          }
        }
      }
    }

    return elements;
  }

  /**
   * Generic method to find affected code elements (legacy support)
   */
  private static findAffectedCodeElementsGeneric(
    affectedLines: number[], 
    codeStructure: CodeElement[]
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
            // Only log first few affected elements to reduce noise
            if (affectedElements.length <= 3) {
              console.log(`📍 Line ${line} affects ${element.type} '${element.name}' (lines ${element.startLine}-${element.endLine})`);
            }
          }
        }
      }
    }

    // Summary logging instead of detailed per-element logging
    if (affectedElements.length === 0) {
      console.log(`⚠️ No specific code elements found for affected lines: ${affectedLines.slice(0, 5).join(', ')}${affectedLines.length > 5 ? '...' : ''}`);
    } else if (affectedElements.length > 3) {
      console.log(`📍 Found ${affectedElements.length} affected elements (showing first 3)`);
    }

    return affectedElements;
  }

  /**
   * Finds the end line of a code block starting at the given line index
   */
  private static findBlockEnd(lines: string[], startIndex: number): number {
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

  private static getFileType(filePath: string): string {
    const extension = filePath.toLowerCase().split('.').pop();
    const typeMap: { [key: string]: string } = {
      'cs': 'C#',
      'razor': 'Razor Component',
      'cshtml': 'Razor Page',
      'ts': 'TypeScript',
      'tsx': 'React TypeScript',
      'js': 'JavaScript',
      'jsx': 'React JavaScript'
    };
    return typeMap[extension || ''] || extension || 'Unknown';
  }
}