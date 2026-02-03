/**
 * World factory for testing
 * Provides functions to create test worlds and chunks
 */

import { ECSWorld } from '../../src/ecs';
import { World, Chunk, ChunkManager, UpdateScheduler, MapManager, TERRAIN, Tile } from '../../src/world';
import { EventBus } from '../../src/core/EventBus';

/**
 * Create a test ECS world
 */
export function createTestECSWorld(eventBus?: EventBus): ECSWorld {
  return new ECSWorld(eventBus);
}

/**
 * Create a test game world with specified dimensions
 */
export function createTestWorld(
  width: number = 100,
  height: number = 100,
  eventBus?: EventBus
): World {
  const ecsWorld = createTestECSWorld(eventBus);
  const world = new World(width, height, 64, ecsWorld);
  world.initialize();
  return world;
}

/**
 * Create a test chunk with specified terrain
 */
export function createTestChunk(
  chunkX: number = 0,
  chunkY: number = 0,
  size: number = 16,
  fillTerrain: keyof typeof TERRAIN = 'floor'
): Chunk {
  const chunk = new Chunk(chunkX, chunkY, size);
  chunk.fill(fillTerrain);
  return chunk;
}

/**
 * Create a chunk with a specific tile pattern
 */
export function createTestChunkWithPattern(
  chunkX: number = 0,
  chunkY: number = 0,
  size: number = 16,
  pattern: (x: number, y: number) => Tile
): Chunk {
  const chunk = new Chunk(chunkX, chunkY, size);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      chunk.setTile(x, y, pattern(x, y));
    }
  }
  
  return chunk;
}

/**
 * Create a chunk manager for testing
 */
export function createTestChunkManager(
  eventBus?: EventBus,
  chunkSize: number = 16
): { chunkManager: ChunkManager; ecsWorld: ECSWorld } {
  const ecsWorld = createTestECSWorld(eventBus);
  const scheduler = new UpdateScheduler();
  const chunkManager = new ChunkManager(chunkSize, scheduler, ecsWorld);
  
  return { chunkManager, ecsWorld };
}

/**
 * Create a map manager for testing
 */
export function createTestMapManager(eventBus?: EventBus): MapManager {
  const ecsWorld = createTestECSWorld(eventBus);
  return new MapManager(ecsWorld);
}
