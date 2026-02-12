/**
 * World generation system
 * Pluggable chunk generators for creating world terrain
 */

import { EventBus } from '../core/EventBus';
import { World, TERRAIN } from '../world';
import { Chunk } from '../world';
import { ECSWorld } from '../ecs';
import { EntityFactory } from '../ecs/EntityFactory';

export interface GeneratorContext {
  world: World;
  ecsWorld: ECSWorld;
  rng: () => number;
  params: Record<string, unknown>;
}

export type ChunkGenerator = (chunk: Chunk, context: GeneratorContext) => void;

export class WorldGenerator {
  private eventBus: EventBus;
  private generators: Map<string, ChunkGenerator> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.registerDefaultGenerators();
  }

  /**
   * Register a chunk generator
   */
  registerGenerator(name: string, generator: ChunkGenerator): void {
    this.generators.set(name, generator);
  }

  /**
   * Get registered generator
   */
  getGenerator(name: string): ChunkGenerator | undefined {
    return this.generators.get(name);
  }

  /**
   * Generate a world using the specified generator
   */
  generateWorld(
    world: World, 
    generatorName: string, 
    params: Record<string, unknown> = {}
  ): void {
    const generator = this.generators.get(generatorName);
    if (!generator) {
      throw new Error(`Generator "${generatorName}" not found`);
    }

    // Simple RNG (could be replaced with rot.js RNG)
    // Use a deterministic default seed for reproducibility
    let seed = (params.seed as number) || 12345;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const context: GeneratorContext = {
      world,
      ecsWorld: world.getECSWorld(),
      rng,
      params
    };

    this.eventBus.emit('generation:started', {
      generator: generatorName,
      seed: params.seed || 'default'
    });

    // Store for chunk generation callback
    (world as any).__generatorContext = context;
    (world as any).__chunkGenerator = generator;
  }

  /**
   * Generate a specific chunk (called by ChunkManager when creating new chunks)
   */
  generateChunk(world: World, chunk: Chunk): void {
    const generator = (world as any).__chunkGenerator;
    const context = (world as any).__generatorContext;
    
    if (generator && context) {
      generator(chunk, context);
    }
  }

  /**
   * Generate a specific layer in a multi-layer world
   */
  generateWorldLayer(
    world: World,
    z: number,
    generatorName: string,
    params: Record<string, unknown> = {}
  ): void {
    const generator = this.generators.get(generatorName);
    if (!generator) {
      throw new Error(`Generator "${generatorName}" not found`);
    }

    // Simple RNG (could be replaced with rot.js RNG)
    // Use a deterministic default seed for reproducibility, modified by layer
    let seed = ((params.seed as number) || 12345) + z * 1000;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const context: GeneratorContext = {
      world,
      ecsWorld: world.getECSWorld(),
      rng,
      params
    };

    this.eventBus.emit('generation:layerStarted', {
      generator: generatorName,
      layer: z,
      seed: params.seed || 'default'
    });

    // Store for chunk generation callback
    if (!(world as any).__layerGenerators) {
      (world as any).__layerGenerators = new Map();
    }
    (world as any).__layerGenerators.set(z, { generator, context });
  }

  private registerDefaultGenerators(): void {
    // Wilderness generator - forests, clearings, rivers
    this.registerGenerator('wilderness', (chunk, context) => {
      const treeDensity = (context.params.treeDensity as number) || 0.3;
      const waterChance = (context.params.waterChance as number) || 0.05;

      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          const rand = context.rng();

          if (rand < waterChance) {
            chunk.setTile(x, y, TERRAIN.water);
          } else if (rand < waterChance + treeDensity) {
            // Spawn tree as entity instead of terrain
            const worldPos = chunk.toWorldPosition(x, y);
            const treeType = context.rng() < 0.7 ? 'oak' : 'pine';
            const treeEntity = EntityFactory.createTree(context.ecsWorld, {
              position: { x: worldPos.x, y: worldPos.y, z: 0 },
              treeType
            });
            chunk.addEntity(treeEntity.id, x, y);
          } else {
            chunk.setTile(x, y, TERRAIN.floor);
          }
        }
      }

      // Add border walls
      for (let x = 0; x < chunk.size; x++) {
        chunk.setTile(x, 0, TERRAIN.wall);
        chunk.setTile(x, chunk.size - 1, TERRAIN.wall);
      }
      for (let y = 0; y < chunk.size; y++) {
        chunk.setTile(0, y, TERRAIN.wall);
        chunk.setTile(chunk.size - 1, y, TERRAIN.wall);
      }
    });

    // Dungeon generator - rooms and corridors
    this.registerGenerator('dungeon', (chunk, context) => {
      const roomChance = (context.params.roomChance as number) || 0.3;
      
      // Start with all walls
      chunk.fill('wall');

      // Carve rooms
      const roomCount = Math.floor(context.rng() * 5) + 3;
      const rooms: Array<{x: number; y: number; w: number; h: number}> = [];

      for (let i = 0; i < roomCount; i++) {
        if (context.rng() > roomChance) continue;

        const w = Math.floor(context.rng() * 10) + 5;
        const h = Math.floor(context.rng() * 10) + 5;
        const x = Math.floor(context.rng() * (chunk.size - w - 2)) + 1;
        const y = Math.floor(context.rng() * (chunk.size - h - 2)) + 1;

        // Check overlap
        let overlaps = false;
        for (const room of rooms) {
          if (x < room.x + room.w && x + w > room.x &&
              y < room.y + room.h && y + h > room.y) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          rooms.push({ x, y, w, h });
          
          // Carve room
          for (let ry = y; ry < y + h; ry++) {
            for (let rx = x; rx < x + w; rx++) {
              chunk.setTile(rx, ry, TERRAIN.floor);
            }
          }
        }
      }

      // Connect rooms with corridors
      for (let i = 0; i < rooms.length - 1; i++) {
        const roomA = rooms[i];
        const roomB = rooms[i + 1];
        
        const startX = Math.floor(roomA.x + roomA.w / 2);
        const startY = Math.floor(roomA.y + roomA.h / 2);
        const endX = Math.floor(roomB.x + roomB.w / 2);
        const endY = Math.floor(roomB.y + roomB.h / 2);

        // L-shaped corridor
        if (context.rng() > 0.5) {
          // Horizontal then vertical
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          for (let x = minX; x <= maxX; x++) {
            chunk.setTile(x, startY, TERRAIN.floor);
          }
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);
          for (let y = minY; y <= maxY; y++) {
            chunk.setTile(endX, y, TERRAIN.floor);
          }
        } else {
          // Vertical then horizontal
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);
          for (let y = minY; y <= maxY; y++) {
            chunk.setTile(startX, y, TERRAIN.floor);
          }
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          for (let x = minX; x <= maxX; x++) {
            chunk.setTile(x, endY, TERRAIN.floor);
          }
        }
      }

      // Add some doors
      for (const room of rooms) {
        if (context.rng() > 0.7) {
          const doorX = room.x + Math.floor(context.rng() * room.w);
          const doorY = room.y + Math.floor(context.rng() * room.h);
          if (chunk.getTile(doorX, doorY)?.terrain === 'floor') {
            // Find adjacent wall to place door
            const adjacent = [
              { x: doorX - 1, y: doorY },
              { x: doorX + 1, y: doorY },
              { x: doorX, y: doorY - 1 },
              { x: doorX, y: doorY + 1 }
            ];
            
            for (const pos of adjacent) {
              if (chunk.getTile(pos.x, pos.y)?.terrain === 'wall') {
                chunk.setTile(pos.x, pos.y, TERRAIN.door);
                break;
              }
            }
          }
        }
      }
    });

    // Cave generator - cellular automata
    this.registerGenerator('cave', (chunk, context) => {
      const fillPercent = (context.params.fillPercent as number) || 0.45;
      const iterations = (context.params.iterations as number) || 5;
      
      // Initialize random walls
      const grid: boolean[][] = [];
      for (let y = 0; y < chunk.size; y++) {
        grid[y] = [];
        for (let x = 0; x < chunk.size; x++) {
          grid[y][x] = context.rng() < fillPercent;
        }
      }

      // Cellular automata smoothing
      for (let i = 0; i < iterations; i++) {
        const newGrid: boolean[][] = [];
        for (let y = 0; y < chunk.size; y++) {
          newGrid[y] = [];
          for (let x = 0; x < chunk.size; x++) {
            const neighbors = this.countWallNeighbors(grid, x, y, chunk.size);
            
            if (neighbors > 4) {
              newGrid[y][x] = true; // Wall
            } else if (neighbors < 4) {
              newGrid[y][x] = false; // Floor
            } else {
              newGrid[y][x] = grid[y][x];
            }
          }
        }
        
        // Copy back
        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            grid[y][x] = newGrid[y][x];
          }
        }
      }

      // Apply to chunk
      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          if (grid[y][x]) {
            chunk.setTile(x, y, TERRAIN.wall);
          } else {
            chunk.setTile(x, y, TERRAIN.floor);
          }
        }
      }
    });

    // City generator - buildings and streets
    this.registerGenerator('city', (chunk, context) => {
      const blockSize = (context.params.blockSize as number) || 20;
      const buildingDensity = (context.params.buildingDensity as number) || 0.7;
      
      // Create street grid
      for (let y = 0; y < chunk.size; y++) {
        for (let x = 0; x < chunk.size; x++) {
          // Streets on regular intervals
          if (x % blockSize === 0 || y % blockSize === 0) {
            chunk.setTile(x, y, TERRAIN.floor);
          } else {
            // Buildings in blocks
            const blockX = Math.floor(x / blockSize);
            const blockY = Math.floor(y / blockSize);
            
            // Vary building placement per block
            const blockSeed = blockX * 374761 + blockY * 668265;
            const blockRng = ((blockSeed * 9301 + 49297) % 233280) / 233280;
            
            if (blockRng < buildingDensity) {
              chunk.setTile(x, y, TERRAIN.wall);
            } else {
              chunk.setTile(x, y, TERRAIN.floor);
            }
          }
        }
      }

      // Add some trees as entities
      for (let y = 0; y < chunk.size; y += 2) {
        for (let x = 0; x < chunk.size; x += 2) {
          if (chunk.getTile(x, y)?.terrain === 'floor' && context.rng() < 0.1) {
            const worldPos = chunk.toWorldPosition(x, y);
            const treeType = context.rng() < 0.6 ? 'oak' : 'birch';
            const treeEntity = EntityFactory.createTree(context.ecsWorld, {
              position: { x: worldPos.x, y: worldPos.y, z: 0 },
              treeType
            });
            chunk.addEntity(treeEntity.id, x, y);
          }
        }
      }
    });
  }

  private countWallNeighbors(grid: boolean[][], x: number, y: number, size: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          count++;
        } else if (grid[ny][nx]) {
          count++;
        }
      }
    }
    return count;
  }
}
