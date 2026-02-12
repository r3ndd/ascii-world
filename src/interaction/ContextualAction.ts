/**
 * Contextual Action types and interfaces
 * Defines the structure for contextual actions available when looking at tiles
 */

import { Entity, ECSWorld } from '../ecs';
import { Position } from '../core/Types';
import { Pathfinding } from '../physics';

export interface ActionContext {
  targetPosition: Position;
  playerEntity: Entity;
  ecsWorld: ECSWorld;
  world: {
    getTileAt(x: number, y: number): { terrain: string; char?: string; fg?: string; bg?: string; blocksMovement?: boolean; blocksLight?: boolean; transparent?: boolean } | null;
  };
  itemManager: {
    getItemsAt(ecsWorld: ECSWorld, position: Position): Entity[];
  };
  fovSystem: {
    isVisible(x: number, y: number): boolean;
    isExplored(x: number, y: number): boolean;
  };
  physicsSystem: {
    moveEntity(entity: Entity, direction: string): boolean;
  };
  pathfinding: Pathfinding;
  eventBus: {
    emit(event: string, data: unknown): void;
  };
}

export interface ContextualAction {
  readonly id: string;
  readonly label: string;
  readonly hotkey: string;
  readonly number: number;
  readonly cost: number; // Action cost in ticks, 0 for free actions
  
  /**
   * Check if this action is available given the context
   */
  isAvailable(context: ActionContext): boolean;
  
  /**
   * Execute the action
   * Returns true if the action was successful and should end look mode
   */
  execute(context: ActionContext): boolean | Promise<boolean>;
  
  /**
   * Get additional description for the action (optional)
   */
  getDescription?(context: ActionContext): string;
}

export abstract class BaseContextualAction implements ContextualAction {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly hotkey: string;
  abstract readonly number: number;
  readonly cost: number = 0;
  
  abstract isAvailable(context: ActionContext): boolean;
  abstract execute(context: ActionContext): boolean | Promise<boolean>;
  
  getDescription(_context: ActionContext): string {
    return '';
  }
}

// Examine action - provides detailed information
export class ExamineAction extends BaseContextualAction {
  readonly id = 'examine';
  readonly label = 'Examine';
  readonly hotkey = 'e';
  readonly number = 1;
  readonly cost = 0;

  isAvailable(context: ActionContext): boolean {
    // Can examine visible tiles or explored tiles
    return context.fovSystem.isVisible(context.targetPosition.x, context.targetPosition.y) ||
           context.fovSystem.isExplored(context.targetPosition.x, context.targetPosition.y);
  }

  execute(context: ActionContext): boolean {
    // Get entities at cursor position
    const entities = context.ecsWorld.queryEntities({ all: ['position'] }).filter(entity => {
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      return pos &&
             pos.x === context.targetPosition.x &&
             pos.y === context.targetPosition.y &&
             pos.z === context.targetPosition.z;
    });

    // Get items at cursor position
    const items = context.itemManager.getItemsAt(context.ecsWorld, context.targetPosition);

    // Get tile info
    const tile = context.world.getTileAt(context.targetPosition.x, context.targetPosition.y);

    // Emit examine event with all information
    context.eventBus.emit('look:examine', {
      position: context.targetPosition,
      entities,
      items,
      tile
    });

    // Examining is a free action that doesn't end look mode
    return false;
  }
}

// Helper function to calculate distance
function getDistance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

// Grab action - pick up items
export class GrabAction extends BaseContextualAction {
  readonly id = 'grab';
  readonly label = 'Grab';
  readonly hotkey = 'g';
  readonly number = 2;
  readonly cost = 50; // Same as PICKUP cost
  
  isAvailable(context: ActionContext): boolean {
    // Must be adjacent to grab
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return false;
    
    const distance = getDistance(playerPos, context.targetPosition);
    if (distance !== 1) return false;
    
    // Must have items at location
    const items = context.itemManager.getItemsAt(context.ecsWorld, context.targetPosition);
    return items.length > 0;
  }
  
  getDescription(context: ActionContext): string {
    const items = context.itemManager.getItemsAt(context.ecsWorld, context.targetPosition);
    if (items.length === 1) {
      const item = items[0];
      const template = item.getComponent<{ type: 'item_template'; name: string }>('item_template');
      return template?.name ?? 'item';
    }
    return `${items.length} items`;
  }
  
  execute(context: ActionContext): boolean {
    // TODO: Implement actual grabbing via inventory system
    // For now, just signal that an action was taken
    console.log(`Grabbing items at (${context.targetPosition.x}, ${context.targetPosition.y})`);
    return true; // End look mode after grabbing
  }
}

// Open action - for doors, containers, etc.
export class OpenAction extends BaseContextualAction {
  readonly id = 'open';
  readonly label = 'Open';
  readonly hotkey = 'o';
  readonly number = 3;
  readonly cost = 100;

  isAvailable(context: ActionContext): boolean {
    // Must be adjacent
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return false;

    const distance = getDistance(playerPos, context.targetPosition);
    if (distance !== 1) return false;

    // Check for openable tile
    const tile = context.world.getTileAt(context.targetPosition.x, context.targetPosition.y);
    return tile?.terrain === 'door'; // Currently doors don't have open/closed state
  }

  execute(context: ActionContext): boolean {
    console.log(`Opening at (${context.targetPosition.x}, ${context.targetPosition.y})`);
    // TODO: Implement actual opening logic
    return true;
  }
}

// Close action - for doors, containers, etc.
export class CloseAction extends BaseContextualAction {
  readonly id = 'close';
  readonly label = 'Close';
  readonly hotkey = 'c';
  readonly number = 4;
  readonly cost = 100;

  isAvailable(context: ActionContext): boolean {
    // Must be adjacent
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return false;

    const distance = getDistance(playerPos, context.targetPosition);
    if (distance !== 1) return false;

    // Check for closable tile - for now, assume we can't close anything
    // This would need door state tracking to be implemented
    return false;
  }

  execute(context: ActionContext): boolean {
    console.log(`Closing at (${context.targetPosition.x}, ${context.targetPosition.y})`);
    // TODO: Implement actual closing logic
    return true;
  }
}

// Use action - for using items, furniture, etc.
export class UseAction extends BaseContextualAction {
  readonly id = 'use';
  readonly label = 'Use';
  readonly hotkey = 'u';
  readonly number = 5;
  readonly cost = 100;

  isAvailable(context: ActionContext): boolean {
    // Must be adjacent
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return false;

    const distance = getDistance(playerPos, context.targetPosition);
    if (distance !== 1) return false;

    // Check for usable tile or items
    const tile = context.world.getTileAt(context.targetPosition.x, context.targetPosition.y);
    const usableTiles = ['stairs_up', 'stairs_down'];
    return usableTiles.includes(tile?.terrain ?? '');
  }

  execute(context: ActionContext): boolean {
    console.log(`Using at (${context.targetPosition.x}, ${context.targetPosition.y})`);
    // TODO: Implement actual use logic
    return true;
  }
}

// Move to action - walk to a position
export class MoveToAction extends BaseContextualAction {
  readonly id = 'move_to';
  readonly label = 'Move to';
  readonly hotkey = 'm';
  readonly number = 6;
  readonly cost = 0; // Cost depends on distance

  isAvailable(context: ActionContext): boolean {
    // Must be visible
    if (!context.fovSystem.isVisible(context.targetPosition.x, context.targetPosition.y)) {
      return false;
    }

    // Must be passable
    const tile = context.world.getTileAt(context.targetPosition.x, context.targetPosition.y);
    if (tile?.blocksMovement) return false;

    // Must not be the current player position
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return false;

    return playerPos.x !== context.targetPosition.x || playerPos.y !== context.targetPosition.y;
  }

  execute(context: ActionContext): boolean {
    // Find path to target
    const playerPos = context.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return true;

    const path = context.pathfinding.findPath(
      playerPos.x,
      playerPos.y,
      context.targetPosition.x,
      context.targetPosition.y
    );

    if (!path || path.length < 2) {
      // No path found or already at destination
      return true;
    }

    // Get the next step (index 1, since index 0 is current position)
    const nextStep = path[1];
    const dx = nextStep.x - playerPos.x;
    const dy = nextStep.y - playerPos.y;

    // Determine direction
    let direction: string;
    if (dx === 0 && dy === -1) direction = 'north';
    else if (dx === 0 && dy === 1) direction = 'south';
    else if (dx === -1 && dy === 0) direction = 'west';
    else if (dx === 1 && dy === 0) direction = 'east';
    else if (dx === 1 && dy === -1) direction = 'northeast';
    else if (dx === -1 && dy === -1) direction = 'northwest';
    else if (dx === 1 && dy === 1) direction = 'southeast';
    else if (dx === -1 && dy === 1) direction = 'southwest';
    else {
      // Unexpected direction
      return true;
    }

    // Move the player one step
    context.physicsSystem.moveEntity(context.playerEntity, direction);

    // Emit path preview for potential UI display
    context.eventBus.emit('look:moveToPath', {
      path: path,
      target: context.targetPosition
    });

    // Return true to close look mode after first step
    // Player can continue moving manually or re-enter look mode
    return true;
  }
}

// Registry of all available contextual actions
export const CONTEXTUAL_ACTIONS: ContextualAction[] = [
  new ExamineAction(),
  new GrabAction(),
  new OpenAction(),
  new CloseAction(),
  new UseAction(),
  new MoveToAction()
];

export function getAvailableActions(context: ActionContext): ContextualAction[] {
  return CONTEXTUAL_ACTIONS.filter(action => action.isAvailable(context));
}
