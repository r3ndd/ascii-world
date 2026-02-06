/**
 * Physics module
 * Collision, movement, pathfinding, FOV, lighting
 */

import * as ROT from 'rot-js';
import { Entity, ECSWorld } from '../ecs';
import { Position, Direction } from '../core/Types';
import { World } from '../world';
import { EventBus } from '../core/EventBus';

// Direction mappings
const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  northeast: { x: 1, y: -1 },
  northwest: { x: -1, y: -1 },
  southeast: { x: 1, y: 1 },
  southwest: { x: -1, y: 1 }
};

// Physics system for collision and movement
export class PhysicsSystem {
  private world: World;
  private eventBus: EventBus;

  constructor(world: World, _ecsWorld: ECSWorld, eventBus: EventBus) {
    this.world = world;
    this.eventBus = eventBus;
  }

  canMoveTo(x: number, y: number, z: number = 0): boolean {
    return this.world.isValidPosition(x, y, z);
  }

  moveEntity(entity: Entity, direction: Direction): boolean {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    
    if (!position) return false;

    const offset = DIRECTION_OFFSETS[direction];
    const newX = position.x + offset.x;
    const newY = position.y + offset.y;
    const currentZ = position.z;

    if (!this.canMoveTo(newX, newY, currentZ)) {
      this.eventBus.emit('physics:movementBlocked', {
        entityId: entity.id,
        from: { x: position.x, y: position.y, z: currentZ },
        to: { x: newX, y: newY, z: currentZ }
      });
      return false;
    }

    // Update position
    position.x = newX;
    position.y = newY;

    this.eventBus.emit('physics:entityMoved', {
      entityId: entity.id,
      from: { x: position.x - offset.x, y: position.y - offset.y, z: currentZ },
      to: { x: newX, y: newY, z: currentZ }
    });

    return true;
  }

  moveEntityTo(entity: Entity, x: number, y: number, z?: number): boolean {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    
    if (!position) return false;

    const targetZ = z ?? position.z;

    if (!this.canMoveTo(x, y, targetZ)) return false;

    const oldX = position.x;
    const oldY = position.y;
    const oldZ = position.z;

    position.x = x;
    position.y = y;
    position.z = targetZ;

    this.eventBus.emit('physics:entityMoved', {
      entityId: entity.id,
      from: { x: oldX, y: oldY, z: oldZ },
      to: { x, y, z: targetZ }
    });

    return true;
  }

  getEntityPosition(entity: Entity): Position | null {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    return position ? { x: position.x, y: position.y, z: position.z } : null;
  }

  /**
   * Ascend to the layer above via stairs
   */
  ascend(entity: Entity, stairsSystem: StairsSystem): boolean {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    
    if (!position) return false;

    const { x, y, z } = position;

    // Check if we can ascend from this position
    if (!stairsSystem.canAscend(x, y, z)) {
      this.eventBus.emit('physics:ascendBlocked', {
        entityId: entity.id,
        position: { x, y, z },
        reason: 'no_stairs_up'
      });
      return false;
    }

    const destination = stairsSystem.getAscendDestination(x, y, z);
    if (!destination) return false;

    // Validate the destination position
    if (!this.world.isValidPosition(destination.x, destination.y, destination.z)) {
      this.eventBus.emit('physics:ascendBlocked', {
        entityId: entity.id,
        position: { x, y, z },
        reason: 'invalid_destination'
      });
      return false;
    }

    // Update position
    position.x = destination.x;
    position.y = destination.y;
    position.z = destination.z ?? 0;

    this.eventBus.emit('physics:entityAscended', {
      entityId: entity.id,
      from: { x, y, z },
      to: destination
    });

    return true;
  }

  /**
   * Descend to the layer below via stairs
   */
  descend(entity: Entity, stairsSystem: StairsSystem): boolean {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    
    if (!position) return false;

    const { x, y, z } = position;

    // Check if we can descend from this position
    if (!stairsSystem.canDescend(x, y, z)) {
      this.eventBus.emit('physics:descendBlocked', {
        entityId: entity.id,
        position: { x, y, z },
        reason: 'no_stairs_down'
      });
      return false;
    }

    const destination = stairsSystem.getDescendDestination(x, y, z);
    if (!destination) return false;

    // Validate the destination position
    if (!this.world.isValidPosition(destination.x, destination.y, destination.z)) {
      this.eventBus.emit('physics:descendBlocked', {
        entityId: entity.id,
        position: { x, y, z },
        reason: 'invalid_destination'
      });
      return false;
    }

    // Update position
    position.x = destination.x;
    position.y = destination.y;
    position.z = destination.z ?? 0;

    this.eventBus.emit('physics:entityDescended', {
      entityId: entity.id,
      from: { x, y, z },
      to: destination
    });

    return true;
  }
}

// Field of View system using rot.js
export class FOVSystem {
  private world: World;
  private visibleTiles: Set<string> = new Set();
  private exploredTiles: Set<string> = new Set();

  constructor(world: World) {
    this.world = world;
  }

  private getTileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  computeFOV(originX: number, originY: number, radius: number): Position[] {
    const visible: Position[] = [];
    this.visibleTiles.clear();

    // Use rot.js FOV
    const fov = new ROT.FOV.PreciseShadowcasting((x, y) => {
      const tile = this.world.getTileAt(x, y);
      return tile ? !tile.blocksLight : false;
    });

    fov.compute(originX, originY, radius, (x, y, _r, _visibility) => {
      visible.push({ x, y });
      this.visibleTiles.add(this.getTileKey(x, y));
      this.exploredTiles.add(this.getTileKey(x, y));
    });

    return visible;
  }

  isVisible(x: number, y: number): boolean {
    return this.visibleTiles.has(this.getTileKey(x, y));
  }

  isExplored(x: number, y: number): boolean {
    return this.exploredTiles.has(this.getTileKey(x, y));
  }

  getVisibleTiles(): Position[] {
    return Array.from(this.visibleTiles).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  }

  reset(): void {
    this.visibleTiles.clear();
  }
}

// Dynamic lighting system
export class LightingSystem {
  private world: World;
  private _lightSources: Map<string, { x: number; y: number; color: [number, number, number]; intensity: number }> = new Map();
  private lighting: ROT.Lighting;
  private emittedLight: Map<string, [number, number, number]> = new Map();

  constructor(world: World) {
    this.world = world;
    
    this.lighting = new ROT.Lighting(
      (x, y) => {
        const tile = this.world.getTileAt(x, y);
        return tile ? (tile.transparent ? 1 : 0) : 0;
      },
      { range: 10, passes: 2 }
    );

    this.lighting.setFOV(new ROT.FOV.PreciseShadowcasting((x, y) => {
      const tile = this.world.getTileAt(x, y);
      return tile ? !tile.blocksLight : false;
    }));
  }

  addLightSource(id: string, x: number, y: number, color: [number, number, number], intensity: number): void {
    this._lightSources.set(id, { x, y, color, intensity });
    this.updateLightSource(id);
  }

  removeLightSource(id: string): void {
    this._lightSources.delete(id);
    this.lighting.clearLights();
    this.rebuildLighting();
  }

  moveLightSource(id: string, x: number, y: number): void {
    const source = this._lightSources.get(id);
    if (source) {
      source.x = x;
      source.y = y;
      this.updateLightSource(id);
    }
  }

  private updateLightSource(id: string): void {
    const source = this._lightSources.get(id);
    if (!source) return;

    this.lighting.clearLights();
    this.rebuildLighting();
  }

  private rebuildLighting(): void {
    for (const source of this._lightSources.values()) {
      this.lighting.setLight(source.x, source.y, source.color);
    }

    this.emittedLight.clear();
    this.lighting.compute((x, y, color) => {
      this.emittedLight.set(`${x},${y}`, color);
    });
  }

  getLightAt(x: number, y: number): [number, number, number] | null {
    return this.emittedLight.get(`${x},${y}`) || null;
  }

  reset(): void {
    this._lightSources.clear();
    this.lighting.clearLights();
    this.emittedLight.clear();
  }
}

// Pathfinding wrapper for rot.js path algorithms
export class Pathfinding {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): Position[] | null {
    const path: Position[] = [];

    const astar = new ROT.Path.AStar(endX, endY, (x, y) => {
      return this.world.isValidPosition(x, y);
    }, { topology: 4 });

    let found = false;
    astar.compute(startX, startY, (x, y) => {
      if (x === endX && y === endY) {
        found = true;
      }
      path.push({ x, y });
    });

    return found ? path : null;
  }

  findPathDijkstra(startX: number, startY: number, targetCallback: (x: number, y: number) => boolean): Position[] | null {
    // Find the target position first by exploring the map
    // We need to determine what the target coordinates are
    let targetX: number | null = null;
    let targetY: number | null = null;
    
    // Search a reasonable area for the target
    const searchRadius = 50;
    for (let y = startY - searchRadius; y <= startY + searchRadius; y++) {
      for (let x = startX - searchRadius; x <= startX + searchRadius; x++) {
        if (targetCallback(x, y)) {
          targetX = x;
          targetY = y;
          break;
        }
      }
      if (targetX !== null) break;
    }
    
    if (targetX === null || targetY === null) {
      return null;
    }
    
    // Use Dijkstra from the target to find path back to start
    // (Dijkstra constructor takes the target, compute takes the start)
    const dijkstra = new ROT.Path.Dijkstra(targetX, targetY, (x, y) => {
      return this.world.isValidPosition(x, y);
    }, { topology: 4 });

    const path: Position[] = [];

    // Compute path from start back to target
    dijkstra.compute(startX, startY, (x, y) => {
      path.push({ x, y });
    });

    // Path is returned from start to target (inclusive)
    // Verify the path actually reached the target
    if (path.length === 0 || !targetCallback(path[path.length - 1].x, path[path.length - 1].y)) {
      return null;
    }

    return path;
  }
}

// Stair connection between layers
export interface StairLink {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  direction: 'up' | 'down';
}

// Stairs system for managing stair connections between layers
export class StairsSystem {
  private stairLinks: Map<string, StairLink> = new Map();
  private eventBus: EventBus;

  constructor(_world: World, eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  private getStairKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Register a stair connection between two positions
   */
  registerStairLink(link: StairLink): void {
    const key = this.getStairKey(link.fromX, link.fromY, link.fromZ);
    this.stairLinks.set(key, link);
    
    this.eventBus.emit('stairs:linkRegistered', {
      from: { x: link.fromX, y: link.fromY, z: link.fromZ },
      to: { x: link.toX, y: link.toY, z: link.toZ },
      direction: link.direction
    });
  }

  /**
   * Get stair link at a position
   */
  getStairLink(x: number, y: number, z: number): StairLink | undefined {
    return this.stairLinks.get(this.getStairKey(x, y, z));
  }

  /**
   * Check if there's a stair connection at the given position
   */
  hasStairLink(x: number, y: number, z: number): boolean {
    return this.stairLinks.has(this.getStairKey(x, y, z));
  }

  /**
   * Get all registered stair links
   */
  getAllStairLinks(): StairLink[] {
    return Array.from(this.stairLinks.values());
  }

  /**
   * Remove a stair link
   */
  removeStairLink(x: number, y: number, z: number): boolean {
    const key = this.getStairKey(x, y, z);
    const link = this.stairLinks.get(key);
    if (link) {
      this.stairLinks.delete(key);
      this.eventBus.emit('stairs:linkRemoved', {
        from: { x, y, z },
        to: { x: link.toX, y: link.toY, z: link.toZ }
      });
      return true;
    }
    return false;
  }

  /**
   * Clear all stair links
   */
  clear(): void {
    this.stairLinks.clear();
    this.eventBus.emit('stairs:allLinksCleared', {});
  }

  /**
   * Check if an entity can ascend from their current position
   */
  canAscend(x: number, y: number, z: number): boolean {
    const link = this.getStairLink(x, y, z);
    return link !== undefined && link.direction === 'up';
  }

  /**
   * Check if an entity can descend from their current position
   */
  canDescend(x: number, y: number, z: number): boolean {
    const link = this.getStairLink(x, y, z);
    return link !== undefined && link.direction === 'down';
  }

  /**
   * Get the destination position when ascending
   */
  getAscendDestination(x: number, y: number, z: number): Position | null {
    const link = this.getStairLink(x, y, z);
    if (link && link.direction === 'up') {
      return { x: link.toX, y: link.toY, z: link.toZ };
    }
    return null;
  }

  /**
   * Get the destination position when descending
   */
  getDescendDestination(x: number, y: number, z: number): Position | null {
    const link = this.getStairLink(x, y, z);
    if (link && link.direction === 'down') {
      return { x: link.toX, y: link.toY, z: link.toZ };
    }
    return null;
  }
}
