/**
 * Utility for parsing git diffs and extracting affected lines
 */
export class DiffParser {
  /**
   * Gets the line numbers that were affected by the diff (added or modified lines)
   */
  public static getAffectedLinesFromDiff(fileDiff: string): number[] {
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
   * Extracts added lines content from diff for legacy identifier extraction
   */
  public static getAddedLinesContent(fileDiff: string): string[] {
    return fileDiff
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1).trim());
  }
}