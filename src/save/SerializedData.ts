/**
 * Serialized World data structures
 */

import { Tile } from '../world';
import { ChunkEntity } from '../world/Chunk';
import { Position } from '../core/Types';
import { SaveMetadata } from './SaveMetadata';
import { EntityId, Component } from '../ecs';
import { ItemTemplate } from '../items';

export interface SerializedWorld {
  width: number;
  height: number;
  chunkSize: number;
  chunks: SerializedChunk[];
  playerPosition: Position;
}

export interface SerializedChunk {
  chunkX: number;
  chunkY: number;
  size: number;
  tiles: Tile[][];
  entities: ChunkEntity[];
  lastUpdateTurn: number;
  needsCatchUp: boolean;
}

export interface SerializedEntity {
  id: EntityId;
  components: Component[];
}

export interface SaveData {
  metadata: SaveMetadata;
  world: SerializedWorld;
  entities: SerializedEntity[];
  // Items are now ECS entities - included in entities above
  templates: ItemTemplate[];
  inventories: {
    ownerId: EntityId;
    capacity: number;
    volumeCapacity: number;
    itemIds: EntityId[];  // Changed from string[] to EntityId[]
  }[];
  turn: {
    currentTurn: number;
  };
}
