/**
 * Map metadata for UI map selection
 */

export interface MapMetadata {
  id: string;
  name: string;
  description: string;
  size: { width: number; height: number };
  thumbnail?: string;
}
