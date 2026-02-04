/**
 * World module
 * World, chunk, and map management
 */

import { Position, ChunkCoord } from '../core/Types';
import { WORLD_DEFAULTS, CourseUpdateLevel } from '../config/WorldDefaults';
import { Entity, EntityId, ECSWorld } from '../ecs';

// Terrain types
type TerrainType = 'floor' | 'wall' | 'water' | 'tree' | 'door' | 'stairs';

// Tile data for a single tile
export interface Tile {
  terrain: TerrainType;
  blocksMovement: boolean;
  blocksLight: boolean;
  transparent: boolean;
  char?: string;
  fg?: string;
  bg?: string;
}

// Default terrain definitions
export const TERRAIN: Record<TerrainType, Tile> = {
  floor: {
    terrain: 'floor',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '.',
    fg: '#888888',
    bg: '#000000'
  },
  wall: {
    terrain: 'wall',
    blocksMovement: true,
    blocksLight: true,
    transparent: false,
    char: '#',
    fg: '#cccccc',
    bg: '#444444'
  },
  water: {
    terrain: 'water',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '~',
    fg: '#0088ff',
    bg: '#000044'
  },
  tree: {
    terrain: 'tree',
    blocksMovement: true,
    blocksLight: false,
    transparent: true,
    char: 'T',
    fg: '#00aa00',
    bg: '#000000'
  },
  door: {
    terrain: 'door',
    blocksMovement: true,
    blocksLight: true,
    transparent: false,
    char: '+',
    fg: '#8b4513',
    bg: '#000000'
  },
  stairs: {
    terrain: 'stairs',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '>',
    fg: '#ffff00',
    bg: '#000000'
  }
};

// Entity reference in a chunk
export interface ChunkEntity {
  entityId: EntityId;
  x: number;
  y: number;
}

// 64x64 tile chunk
export class Chunk {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly size: number;
  private tiles: Tile[][];
  private entities: Map<EntityId, ChunkEntity> = new Map();
  private lastUpdateTurn: number = 0;
  private needsCatchUp: boolean = false;

  constructor(chunkX: number, chunkY: number, size: number = 64) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.size = size;
    this.tiles = Array(size).fill(null).map(() => 
      Array(size).fill(null).map(() => TERRAIN.floor)
    );
  }

  getTile(localX: number, localY: number): Tile | null {
    if (!this.isValidLocalPosition(localX, localY)) return null;
    return this.tiles[localY][localX];
  }

  setTile(localX: number, localY: number, tile: Tile): boolean {
    if (!this.isValidLocalPosition(localX, localY)) return false;
    this.tiles[localY][localX] = tile;
    return true;
  }

  addEntity(entityId: EntityId, localX: number, localY: number): void {
    this.entities.set(entityId, { entityId, x: localX, y: localY });
  }

  removeEntity(entityId: EntityId): boolean {
    return this.entities.delete(entityId);
  }

  getEntityPosition(entityId: EntityId): { x: number; y: number } | null {
    const entity = this.entities.get(entityId);
    return entity ? { x: entity.x, y: entity.y } : null;
  }

  getAllEntities(): ChunkEntity[] {
    return Array.from(this.entities.values());
  }

  getLastUpdateTurn(): number {
    return this.lastUpdateTurn;
  }

  markUpdated(turn: number): void {
    this.lastUpdateTurn = turn;
  }

  isCatchUpNeeded(): boolean {
    return this.needsCatchUp;
  }

  setCatchUpNeeded(needed: boolean): void {
    this.needsCatchUp = needed;
  }

  isValidLocalPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  toWorldPosition(localX: number, localY: number): Position {
    return {
      x: this.chunkX * this.size + localX,
      y: this.chunkY * this.size + localY
    };
  }

  toLocalPosition(worldX: number, worldY: number): Position {
    return {
      x: worldX - this.chunkX * this.size,
      y: worldY - this.chunkY * this.size
    };
  }

  fill(terrain: TerrainType): void {
    const tile = TERRAIN[terrain];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.tiles[y][x] = tile;
      }
    }
  }
}

// Distance-based update scheduling
export class UpdateScheduler {
  private courseSchedule: CourseUpdateLevel[];
  private fullUpdateDistance: number;
  private lastUpdates: Map<string, number> = new Map();
  private currentTurn: number = 0;

  constructor(
    courseSchedule: CourseUpdateLevel[] = WORLD_DEFAULTS.courseUpdateSchedule,
    fullUpdateDistance: number = WORLD_DEFAULTS.fullUpdateDistance
  ) {
    this.courseSchedule = courseSchedule;
    this.fullUpdateDistance = fullUpdateDistance;
  }

  getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  getDistanceFromPlayer(chunkX: number, chunkY: number, playerChunkX: number, playerChunkY: number): number {
    return Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkY - playerChunkY));
  }

  shouldUpdate(chunkX: number, chunkY: number, playerChunkX: number, playerChunkY: number): boolean {
    const distance = this.getDistanceFromPlayer(chunkX, chunkY, playerChunkX, playerChunkY);
    const key = this.getChunkKey(chunkX, chunkY);
    const lastUpdate = this.lastUpdates.get(key) || 0;
    const turnsSinceUpdate = this.currentTurn - lastUpdate;

    // Full update range
    if (distance <= this.fullUpdateDistance) {
      return true;
    }

    // Course update schedule
    for (const level of this.courseSchedule) {
      if (distance >= level.minDist && distance <= level.maxDist) {
        return turnsSinceUpdate >= level.interval;
      }
    }

    return false;
  }

  markUpdated(chunkX: number, chunkY: number): void {
    this.lastUpdates.set(this.getChunkKey(chunkX, chunkY), this.currentTurn);
  }

  advanceTurn(): void {
    this.currentTurn++;
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getTurnsSinceLastUpdate(chunkX: number, chunkY: number): number {
    const key = this.getChunkKey(chunkX, chunkY);
    const lastUpdate = this.lastUpdates.get(key) || 0;
    return this.currentTurn - lastUpdate;
  }
}

// Chunk lifecycle management
export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private activeChunks: Set<string> = new Set();
  private chunkSize: number;
  private updateScheduler: UpdateScheduler;
  private playerChunkX: number = Infinity;
  private playerChunkY: number = Infinity;
  private ecsWorld: ECSWorld;

  constructor(
    chunkSize: number = WORLD_DEFAULTS.chunkSize,
    updateScheduler: UpdateScheduler,
    ecsWorld: ECSWorld
  ) {
    this.chunkSize = chunkSize;
    this.updateScheduler = updateScheduler;
    this.ecsWorld = ecsWorld;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  worldToChunk(worldX: number, worldY: number): ChunkCoord {
    return {
      chunkX: Math.floor(worldX / this.chunkSize),
      chunkY: Math.floor(worldY / this.chunkSize)
    };
  }

  getOrCreateChunk(chunkX: number, chunkY: number): Chunk {
    const key = this.getChunkKey(chunkX, chunkY);
    
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(chunkX, chunkY, this.chunkSize);
      this.chunks.set(key, chunk);
      
      // Generate simple terrain (placeholder for real generation)
      this.generateTerrain(chunk);
    }
    
    return this.chunks.get(key)!;
  }

  private generateTerrain(chunk: Chunk): void {
    // Simple placeholder generation - mostly floor with some walls
    for (let y = 0; y < chunk.size; y++) {
      for (let x = 0; x < chunk.size; x++) {
        // Border walls
        if (x === 0 || x === chunk.size - 1 || y === 0 || y === chunk.size - 1) {
          chunk.setTile(x, y, TERRAIN.wall);
        } else if (Math.random() < 0.05) {
          // Random trees
          chunk.setTile(x, y, TERRAIN.tree);
        }
      }
    }
  }

  getChunk(chunkX: number, chunkY: number): Chunk | null {
    return this.chunks.get(this.getChunkKey(chunkX, chunkY)) || null;
  }

  setPlayerPosition(worldX: number, worldY: number): void {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    
    if (chunkX !== this.playerChunkX || chunkY !== this.playerChunkY) {
      this.deactivateDistantChunks(chunkX, chunkY);
      this.playerChunkX = chunkX;
      this.playerChunkY = chunkY;
      this.activateNearbyChunks();
    }
  }

  private activateNearbyChunks(): void {
    // Activate 3x3 grid around player
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunkX = this.playerChunkX + dx;
        const chunkY = this.playerChunkY + dy;
        const key = this.getChunkKey(chunkX, chunkY);
        
        if (!this.activeChunks.has(key)) {
          this.activateChunk(chunkX, chunkY);
        }
      }
    }
  }

  private activateChunk(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    
    this.activeChunks.add(key);
    
    // Check for catch-up needed
    const turnsSinceUpdate = this.updateScheduler.getTurnsSinceLastUpdate(chunkX, chunkY);
    if (turnsSinceUpdate > 0 && chunk.getLastUpdateTurn() > 0) {
      chunk.setCatchUpNeeded(true);
    }
  }

  private deactivateDistantChunks(newPlayerChunkX: number, newPlayerChunkY: number): void {
    const toDeactivate: string[] = [];
    
    for (const key of this.activeChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      const distance = Math.max(
        Math.abs(chunkX - newPlayerChunkX),
        Math.abs(chunkY - newPlayerChunkY)
      );
      
      if (distance > 1) {
        toDeactivate.push(key);
      }
    }
    
    for (const key of toDeactivate) {
      this.activeChunks.delete(key);
    }
  }

  update(): void {
    // Update chunks based on distance from player
    for (const key of this.activeChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      
      if (this.updateScheduler.shouldUpdate(chunkX, chunkY, this.playerChunkX, this.playerChunkY)) {
        this.processChunkUpdate(chunkX, chunkY);
        this.updateScheduler.markUpdated(chunkX, chunkY);
      }
    }
    
    this.updateScheduler.advanceTurn();
  }

  private processChunkUpdate(chunkX: number, chunkY: number): void {
    const chunk = this.getChunk(chunkX, chunkY);
    if (!chunk) return;
    
    // Handle catch-up if needed
    if (chunk.isCatchUpNeeded()) {
      this.processCatchUp(chunk);
      chunk.setCatchUpNeeded(false);
    }
    
    // Regular chunk update
    chunk.markUpdated(this.updateScheduler.getCurrentTurn());
  }

  private processCatchUp(chunk: Chunk): void {
    const turnsSinceUpdate = this.updateScheduler.getTurnsSinceLastUpdate(chunk.chunkX, chunk.chunkY);
    const entities = chunk.getAllEntities();
    
    if (turnsSinceUpdate <= 0) return;
    
    for (const chunkEntity of entities) {
      const entity = this.ecsWorld.getEntity(chunkEntity.entityId);
      if (entity) {
        // Process deferred updates for entity over missed turns
        // This would simulate hunger, thirst, status effects, etc.
        // For now, just a placeholder
        entity.getComponent('actor');
      }
    }
  }

  getActiveChunks(): Chunk[] {
    return Array.from(this.activeChunks)
      .map(key => this.chunks.get(key)!)
      .filter(chunk => chunk !== undefined);
  }

  getTileAt(worldX: number, worldY: number): Tile | null {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    const chunk = this.getChunk(chunkX, chunkY);
    
    if (!chunk) return null;
    
    const localPos = chunk.toLocalPosition(worldX, worldY);
    return chunk.getTile(localPos.x, localPos.y);
  }

  setTileAt(worldX: number, worldY: number, tile: Tile): boolean {
    const { chunkX, chunkY } = this.worldToChunk(worldX, worldY);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    const localPos = chunk.toLocalPosition(worldX, worldY);
    return chunk.setTile(localPos.x, localPos.y, tile);
  }

  isValidPosition(worldX: number, worldY: number): boolean {
    const tile = this.getTileAt(worldX, worldY);
    return tile !== null && !tile.blocksMovement;
  }
}

// World container
export class World {
  private width: number;
  private height: number;
  private chunkManager: ChunkManager;
  private updateScheduler: UpdateScheduler;
  private ecsWorld: ECSWorld;

  constructor(
    width: number = WORLD_DEFAULTS.width,
    height: number = WORLD_DEFAULTS.height,
    chunkSize: number = WORLD_DEFAULTS.chunkSize,
    ecsWorld: ECSWorld
  ) {
    this.width = width;
    this.height = height;
    this.ecsWorld = ecsWorld;
    this.updateScheduler = new UpdateScheduler();
    this.chunkManager = new ChunkManager(chunkSize, this.updateScheduler, ecsWorld);
  }

  initialize(): void {
    // Initial chunk generation at center
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    this.chunkManager.setPlayerPosition(centerX, centerY);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getChunkManager(): ChunkManager {
    return this.chunkManager;
  }

  getUpdateScheduler(): UpdateScheduler {
    return this.updateScheduler;
  }

  getTileAt(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.chunkManager.getTileAt(x, y);
  }

  setTileAt(x: number, y: number, tile: Tile): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.chunkManager.setTileAt(x, y, tile);
  }

  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height &&
           this.chunkManager.isValidPosition(x, y);
  }

  update(): void {
    this.chunkManager.update();
  }

  setPlayerPosition(x: number, y: number): void {
    this.chunkManager.setPlayerPosition(x, y);
  }

  getEntitiesAt(x: number, y: number): Entity[] {
    const { chunkX, chunkY } = this.chunkManager.worldToChunk(x, y);
    const chunk = this.chunkManager.getChunk(chunkX, chunkY);
    
    if (!chunk) return [];
    
    const localPos = chunk.toLocalPosition(x, y);
    const chunkEntities = chunk.getAllEntities();
    const entities: Entity[] = [];
    
    for (const chunkEntity of chunkEntities) {
      if (chunkEntity.x === localPos.x && chunkEntity.y === localPos.y) {
        const entity = this.ecsWorld.getEntity(chunkEntity.entityId);
        if (entity) {
          entities.push(entity);
        }
      }
    }
    
    return entities;
  }
}

// Map metadata
export interface MapMetadata {
  id: string;
  name: string;
  description: string;
  size: { width: number; height: number };
  thumbnail?: string;
}

// Multiple map support
export class MapManager {
  private maps: Map<string, MapMetadata> = new Map();
  private currentMap: World | null = null;
  private ecsWorld: ECSWorld;

  constructor(ecsWorld: ECSWorld) {
    this.ecsWorld = ecsWorld;
  }

  registerMap(metadata: MapMetadata): void {
    this.maps.set(metadata.id, metadata);
  }

  getMap(id: string): MapMetadata | undefined {
    return this.maps.get(id);
  }

  getAllMaps(): MapMetadata[] {
    return Array.from(this.maps.values());
  }

  loadMap(id: string, width?: number, height?: number): World {
    const metadata = this.maps.get(id);
    
    if (!metadata) {
      throw new Error(`Map ${id} not found`);
    }

    this.currentMap = new World(
      width || metadata.size.width,
      height || metadata.size.height,
      WORLD_DEFAULTS.chunkSize,
      this.ecsWorld
    );
    
    this.currentMap.initialize();
    return this.currentMap;
  }

  createDefaultWorld(): World {
    const world = new World(
      WORLD_DEFAULTS.width,
      WORLD_DEFAULTS.height,
      WORLD_DEFAULTS.chunkSize,
      this.ecsWorld
    );
    world.initialize();
    this.currentMap = world;
    return world;
  }

  getCurrentMap(): World | null {
    return this.currentMap;
  }
}

export type { TerrainType };
