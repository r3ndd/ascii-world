/**
 * World Serializer
 * Handles world state serialization
 */

import { World } from '../world';
import { Chunk } from '../world/Chunk';
import { Tile, TERRAIN } from '../world/WorldConfig';
import { Position } from '../core/Types';
import { SerializedWorld, SerializedChunk } from './SerializedData';

export class WorldSerializer {
  static serialize(world: World): SerializedWorld {
    const chunkManager = world.getChunkManager();
    const activeChunks = chunkManager.getActiveChunks();
    
    // Serialize all chunks (you might want to limit this for performance)
    const serializedChunks: SerializedChunk[] = activeChunks.map(chunk => this.serializeChunk(chunk));

    // Get player position (approximate from active chunks)
    // In a real implementation, you'd track the player entity separately
    const playerPosition: Position = { x: 0, y: 0 }; // Placeholder

    return {
      width: world.getWidth(),
      height: world.getHeight(),
      chunkSize: 64, // TODO: get from chunk
      chunks: serializedChunks,
      playerPosition
    };
  }

  static serializeChunk(chunk: Chunk): SerializedChunk {
    // Get all tiles
    const tiles: Tile[][] = [];
    for (let y = 0; y < chunk.size; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < chunk.size; x++) {
        const tile = chunk.getTile(x, y);
        row.push(tile || TERRAIN.floor);
      }
      tiles.push(row);
    }

    return {
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      size: chunk.size,
      tiles,
      entities: chunk.getAllEntities(),
      lastUpdateTurn: chunk.getLastUpdateTurn(),
      needsCatchUp: chunk.isCatchUpNeeded()
    };
  }

  static deserializeWorld(data: SerializedWorld): {
    width: number;
    height: number;
    chunkSize: number;
    chunks: SerializedChunk[];
  } {
    return {
      width: data.width,
      height: data.height,
      chunkSize: data.chunkSize,
      chunks: data.chunks
    };
  }

  // Apply serialized chunk data to an existing chunk
  static applyChunkData(chunk: Chunk, data: SerializedChunk): void {
    // Restore tiles
    for (let y = 0; y < data.size && y < chunk.size; y++) {
      for (let x = 0; x < data.size && x < chunk.size; x++) {
        if (data.tiles[y] && data.tiles[y][x]) {
          chunk.setTile(x, y, data.tiles[y][x]);
        }
      }
    }

    // Restore entity references (actual entities are loaded separately)
    for (const entityRef of data.entities) {
      chunk.addEntity(entityRef.entityId, entityRef.x, entityRef.y);
    }

    // Restore chunk state
    chunk.markUpdated(data.lastUpdateTurn);
    if (data.needsCatchUp) {
      chunk.setCatchUpNeeded(true);
    }
  }
}
