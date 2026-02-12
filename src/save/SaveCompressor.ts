/**
 * Save Compressor
 * Compression utility for large saves
 */

export class SaveCompressor {
  // Simple compression using LZ-string like approach
  // In production, you might want to use a proper library like pako for gzip
  static compress(data: string): string {
    // For now, just return as-is (compression can be added later)
    return data;
  }

  static decompress(data: string): string {
    // For now, just return as-is
    return data;
  }
}
