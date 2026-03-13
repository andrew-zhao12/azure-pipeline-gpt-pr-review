/**
 * Builds optimized search queries for Azure AI Search
 */
export class SearchQueryBuilder {
  /**
   * Builds an optimized search query for the identifier
   */
  public static buildSearchQuery(identifier: string, type: string): string {
    // Escape special characters for Azure Search
    const escapedIdentifier = identifier.replace(/[+\-&|!(){}\[\]^"~*?:\\]/g, '\\$&');
    
    // Build query based on the type of identifier
    switch (type.toLowerCase()) {
      case 'function':
        // Search for function calls, method invocations, and references
        return `(${escapedIdentifier} OR "${escapedIdentifier}(" OR ".${escapedIdentifier}(" OR "${escapedIdentifier}.") AND NOT (function ${escapedIdentifier} OR const ${escapedIdentifier} OR let ${escapedIdentifier} OR var ${escapedIdentifier})`;
        
      case 'class':
        // Search for class usage, instantiation, and inheritance
        return `(${escapedIdentifier} OR "new ${escapedIdentifier}(" OR "extends ${escapedIdentifier}" OR "implements ${escapedIdentifier}" OR ": ${escapedIdentifier}" OR "${escapedIdentifier}.") AND NOT (class ${escapedIdentifier})`;
        
      case 'interface':
        // Search for interface implementation and type annotations
        return `(${escapedIdentifier} OR "implements ${escapedIdentifier}" OR ": ${escapedIdentifier}" OR "extends ${escapedIdentifier}") AND NOT (interface ${escapedIdentifier})`;
        
      case 'type':
        // Search for type usage in annotations and generics
        return `(${escapedIdentifier} OR ": ${escapedIdentifier}" OR "<${escapedIdentifier}>" OR "as ${escapedIdentifier}") AND NOT (type ${escapedIdentifier})`;
        
      case 'component':
        // Search for Razor component usage
        return `(${escapedIdentifier} OR "<${escapedIdentifier}" OR "<${escapedIdentifier}>" OR "@${escapedIdentifier}" OR "Component=\"${escapedIdentifier}\"")`;
        
      case 'variable':
        // Search for variable usage and references
        return `${escapedIdentifier} AND NOT (const ${escapedIdentifier} OR let ${escapedIdentifier} OR var ${escapedIdentifier})`;
        
      default:
        // Generic search for any identifier
        return escapedIdentifier;
    }
  }

  /**
   * Builds search body for Azure AI Search request
   */
  public static buildSearchBody(
    identifier: string,
    type: string,
    excludeFilePath: string,
    targetBranch: string,
    top: number = 50
  ) {
    const searchQuery = this.buildSearchQuery(identifier, type);
    return {
      search: searchQuery,
      select: 'filepath,content,title,startLine,endLine,branch,language',
      top: top,
      highlight: 'content,title',
      filter: `filepath ne '${excludeFilePath.replace(/'/g, "''")}' and branch eq '${targetBranch.replace(/'/g, "''")}'`,
    };
  }
}