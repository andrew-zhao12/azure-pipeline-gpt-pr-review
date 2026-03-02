import { DiffParser } from './diff-parser';

/**
 * Legacy identifier extraction logic - kept for reference and fallback scenarios
 */
export class LegacyIdentifierExtractor {
  /**
   * Legacy method - extracts identifiers from diff and file content
   * No longer used in main flow but kept for reference
   */
  public static extractIdentifiersFromDiff(
    fileDiff: string, 
    fileContent: string
  ): Array<{name: string, type: 'function' | 'class' | 'variable' | 'interface' | 'type'}> {
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
    const addedLines = DiffParser.getAddedLinesContent(fileDiff);
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
}