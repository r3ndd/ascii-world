/**
 * World module
 * World, chunk, and map management
 */

import { Position, ChunkCoord } from '../core/Types';
import { WORLD_DEFAULTS, CourseUpdateLevel } from '../config/WorldDefaults';
import { Entity, EntityId, ECSWorld } from '../ecs';

// Terrain types
type TerrainType = 'floor' | 'wall' | 'water' | 'tree' | 'door' | 'stairs_up' | 'stairs_down';

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
  stairs_up: {
    terrain: 'stairs_up',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '>',
    fg: '#ffff00',
    bg: '#000000'
  },
  stairs_down: {
    terrain: 'stairs_down',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '<',
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
    // Use a deterministic RNG seeded by chunk coordinates
    // This ensures the same chunk always generates the same terrain
    let seed = chunk.chunkX * 374761 + chunk.chunkY * 668265; // Large primes for better distribution
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Simple placeholder generation - mostly floor with some walls
    for (let y = 0; y < chunk.size; y++) {
      for (let x = 0; x < chunk.size; x++) {
        // Border walls
        if (x === 0 || x === chunk.size - 1 || y === 0 || y === chunk.size - 1) {
          chunk.setTile(x, y, TERRAIN.wall);
        } else if (rng() < 0.05) {
          // Random trees (deterministic based on chunk position)
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

// Layer configuration for multi-layer worlds
export interface LayerConfig {
  width: number;
  height: number;
}

// World container - supports multiple z-layers
export class World {
  private layers: Map<number, LayerConfig> = new Map();
  private chunkManagers: Map<number, ChunkManager> = new Map();
  private updateScheduler: UpdateScheduler;
  private ecsWorld: ECSWorld;
  private chunkSize: number;
  private defaultLayer: number = 0;

  constructor(
    width: number = WORLD_DEFAULTS.width,
    height: number = WORLD_DEFAULTS.height,
    chunkSize: number = WORLD_DEFAULTS.chunkSize,
    ecsWorld: ECSWorld
  ) {
    this.chunkSize = chunkSize;
    this.ecsWorld = ecsWorld;
    this.updateScheduler = new UpdateScheduler();
    
    // Create default layer 0
    this.addLayer(0, width, height);
  }

  /**
   * Add a new layer to the world
   */
  addLayer(z: number, width: number, height: number): void {
    this.layers.set(z, { width, height });
    this.chunkManagers.set(z, new ChunkManager(this.chunkSize, this.updateScheduler, this.ecsWorld));
  }

  /**
   * Remove a layer from the world
   */
  removeLayer(z: number): boolean {
    if (z === this.defaultLayer) {
      throw new Error('Cannot remove the default layer (0)');
    }
    return this.layers.delete(z) && this.chunkManagers.delete(z);
  }

  /**
   * Check if a layer exists
   */
  hasLayer(z: number): boolean {
    return this.layers.has(z);
  }

  /**
   * Get all layer indices
   */
  getLayers(): number[] {
    return Array.from(this.layers.keys()).sort((a, b) => a - b);
  }

  /**
   * Get the chunk manager for a specific layer
   */
  getChunkManager(z: number = this.defaultLayer): ChunkManager {
    const manager = this.chunkManagers.get(z);
    if (!manager) {
      throw new Error(`Layer ${z} does not exist`);
    }
    return manager;
  }

  initialize(): void {
    // Initial chunk generation at center of default layer
    const config = this.layers.get(this.defaultLayer)!;
    const centerX = Math.floor(config.width / 2);
    const centerY = Math.floor(config.height / 2);
    this.getChunkManager(this.defaultLayer).setPlayerPosition(centerX, centerY);
  }

  getWidth(z: number = this.defaultLayer): number {
    const config = this.layers.get(z);
    return config ? config.width : 0;
  }

  getHeight(z: number = this.defaultLayer): number {
    const config = this.layers.get(z);
    return config ? config.height : 0;
  }

  getUpdateScheduler(): UpdateScheduler {
    return this.updateScheduler;
  }

  getTileAt(x: number, y: number, z: number = this.defaultLayer): Tile | null {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return null;
    }
    return this.getChunkManager(z).getTileAt(x, y);
  }

  setTileAt(x: number, y: number, tile: Tile, z: number = this.defaultLayer): boolean {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return false;
    }
    return this.getChunkManager(z).setTileAt(x, y, tile);
  }

  isValidPosition(x: number, y: number, z: number = this.defaultLayer): boolean {
    const config = this.layers.get(z);
    if (!config || x < 0 || x >= config.width || y < 0 || y >= config.height) {
      return false;
    }
    return this.getChunkManager(z).isValidPosition(x, y);
  }

  update(): void {
    // Update all layers
    for (const chunkManager of this.chunkManagers.values()) {
      chunkManager.update();
    }
  }

  setPlayerPosition(x: number, y: number, z: number = this.defaultLayer): void {
    this.getChunkManager(z).setPlayerPosition(x, y);
  }

  getEntitiesAt(x: number, y: number, z: number = this.defaultLayer): Entity[] {
    const chunkManager = this.getChunkManager(z);
    const { chunkX, chunkY } = chunkManager.worldToChunk(x, y);
    const chunk = chunkManager.getChunk(chunkX, chunkY);
    
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
