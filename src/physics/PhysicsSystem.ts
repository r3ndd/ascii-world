/**
 * Physics System
 * Collision and movement handling
 */

import { Entity, ECSWorld } from '../ecs';
import { Position, Direction } from '../core/Types';
import { World } from '../world';
import { EventBus } from '../core/EventBus';
import { StairsSystem } from './StairsSystem';

// Direction mappings
export const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  northeast: { x: 1, y: -1 },
  northwest: { x: -1, y: -1 },
  southeast: { x: 1, y: 1 },
  southwest: { x: -1, y: 1 }
};

export class PhysicsSystem {
  private world: World;
  private ecsWorld: ECSWorld;
  private eventBus: EventBus;

  constructor(world: World, ecsWorld: ECSWorld, eventBus: EventBus) {
    this.world = world;
    this.ecsWorld = ecsWorld;
    this.eventBus = eventBus;
  }

  canMoveTo(x: number, y: number, z: number = 0, excludeEntity?: Entity): boolean {
    // Check terrain collision
    if (!this.world.isValidPosition(x, y, z)) {
      return false;
    }

    // Check entity collision - only block if entity has blocking component (e.g., tree)
    const entitiesAtTarget = this.ecsWorld.getEntitiesAtPosition(x, y, z);
    for (const entity of entitiesAtTarget) {
      if (entity !== excludeEntity && this.entityBlocksMovement(entity)) {
        return false;
      }
    }

    return true;
  }

  private entityBlocksMovement(entity: Entity): boolean {
    // Entities with 'blocking' component block movement
    return entity.hasComponent('blocking');
  }

  moveEntity(entity: Entity, direction: Direction): boolean {
    const position = entity.getComponent('position') as { type: 'position'; x: number; y: number; z: number } | undefined;
    
    if (!position) return false;

    const offset = DIRECTION_OFFSETS[direction];
    const newX = position.x + offset.x;
    const newY = position.y + offset.y;
    const currentZ = position.z;

    if (!this.canMoveTo(newX, newY, currentZ, entity)) {
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

    if (!this.canMoveTo(x, y, targetZ, entity)) return false;

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
