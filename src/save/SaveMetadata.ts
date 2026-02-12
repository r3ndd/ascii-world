/**
 * Save Metadata
 */

import { Position } from '../core/Types';

export interface SaveMetadata {
  slot: number;
  name: string;
  timestamp: number;
  turn: number;
  playerPosition: Position;
  playTime: number; // in seconds
  version: string;
  checksum: string;
}
