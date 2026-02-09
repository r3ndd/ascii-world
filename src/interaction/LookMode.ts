/**
 * Look Mode Controller
 * Manages the look mode state and cursor position
 * CDDA-style tile examination and contextual actions
 */

import { EventBus } from '../core/EventBus';
import { Position, Direction } from '../core/Types';
import { Entity } from '../ecs';
import { World } from '../world';
import { FOVSystem } from '../physics';
import { ContextualAction, ActionContext, getAvailableActions } from './ContextualAction';
import { ItemManager } from '../items/ItemManager';
import { PhysicsSystem } from '../physics';
import { ECSWorld } from '../ecs';

export interface LookModeConfig {
  sidebarWidth: number; // Number of columns for the sidebar
}

export const DEFAULT_LOOK_MODE_CONFIG: LookModeConfig = {
  sidebarWidth: 20
};

export class LookMode {
  private isActive: boolean = false;
  private cursorPosition: Position = { x: 0, y: 0, z: 0 };
  private playerEntity: Entity | null = null;
  private world: World;
  private fovSystem: FOVSystem;
  private itemManager: ItemManager;
  private physicsSystem: PhysicsSystem;
  private ecsWorld: ECSWorld;
  private eventBus: EventBus;
  private config: LookModeConfig;
  
  private availableActions: ContextualAction[] = [];
  private lastContext: ActionContext | null = null;

  constructor(
    world: World,
    fovSystem: FOVSystem,
    itemManager: ItemManager,
    physicsSystem: PhysicsSystem,
    ecsWorld: ECSWorld,
    eventBus: EventBus,
    config: LookModeConfig = DEFAULT_LOOK_MODE_CONFIG
  ) {
    this.world = world;
    this.fovSystem = fovSystem;
    this.itemManager = itemManager;
    this.physicsSystem = physicsSystem;
    this.ecsWorld = ecsWorld;
    this.eventBus = eventBus;
    this.config = config;
  }

  /**
   * Enter look mode
   * Cursor starts at player position
   */
  enter(playerEntity: Entity): boolean {
    if (this.isActive) return false;
    
    const pos = playerEntity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
    if (!pos) return false;
    
    this.playerEntity = playerEntity;
    this.cursorPosition = { x: pos.x, y: pos.y, z: pos.z };
    this.isActive = true;
    
    this.updateAvailableActions();
    
    this.eventBus.emit('look:modeEntered', {
      position: this.cursorPosition,
      actions: this.availableActions
    });
    
    return true;
  }

  /**
   * Exit look mode
   */
  exit(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.availableActions = [];
    this.lastContext = null;
    
    this.eventBus.emit('look:modeExited', {});
  }

  /**
   * Check if look mode is currently active
   */
  isEnabled(): boolean {
    return this.isActive;
  }

  /**
   * Get current cursor position
   */
  getCursorPosition(): Position {
    return { ...this.cursorPosition };
  }

  /**
   * Move cursor in a direction
   * Returns true if the move was valid
   */
  moveCursor(direction: Direction): boolean {
    if (!this.isActive) return false;
    
    const newPosition = { ...this.cursorPosition };
    
    switch (direction) {
      case 'north':
      case 'northeast':
      case 'northwest':
        newPosition.y--;
        break;
      case 'south':
      case 'southeast':
      case 'southwest':
        newPosition.y++;
        break;
    }
    
    switch (direction) {
      case 'west':
      case 'northwest':
      case 'southwest':
        newPosition.x--;
        break;
      case 'east':
      case 'northeast':
      case 'southeast':
        newPosition.x++;
        break;
    }
    
    // Check if the new position is valid (visible or explored)
    if (!this.canLookAt(newPosition.x, newPosition.y)) {
      return false;
    }
    
    this.cursorPosition = newPosition;
    this.updateAvailableActions();
    
    this.eventBus.emit('look:cursorMoved', {
      position: this.cursorPosition,
      actions: this.availableActions
    });
    
    return true;
  }

  /**
   * Check if a position can be looked at (visible or explored)
   */
  canLookAt(x: number, y: number): boolean {
    return this.fovSystem.isVisible(x, y) || this.fovSystem.isExplored(x, y);
  }

  /**
   * Get tile visibility status at cursor position
   */
  getVisibilityStatus(): 'visible' | 'explored' | 'unknown' {
    if (this.fovSystem.isVisible(this.cursorPosition.x, this.cursorPosition.y)) {
      return 'visible';
    }
    if (this.fovSystem.isExplored(this.cursorPosition.x, this.cursorPosition.y)) {
      return 'explored';
    }
    return 'unknown';
  }

  /**
   * Get information about the tile at cursor position
   */
  getTileInfo(): {
    type: string;
    name: string;
    description: string;
    char: string;
    fg: string;
    bg: string;
    blocksMovement: boolean;
    blocksLight: boolean;
    transparent: boolean;
  } | null {
    const tile = this.world.getTileAt(this.cursorPosition.x, this.cursorPosition.y);
    if (!tile) return null;
    
    return {
      type: tile.terrain ?? 'unknown',
      name: tile.terrain ?? 'Unknown',
      description: '',
      char: tile.char ?? '?',
      fg: tile.fg ?? '#ffffff',
      bg: tile.bg ?? '#000000',
      blocksMovement: tile.blocksMovement ?? false,
      blocksLight: tile.blocksLight ?? false,
      transparent: tile.transparent ?? true
    };
  }

  /**
   * Get entities at cursor position
   */
  getEntitiesAtCursor(): Entity[] {
    return this.ecsWorld.queryEntities({ all: ['position'] }).filter(entity => {
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      return pos && 
             pos.x === this.cursorPosition.x && 
             pos.y === this.cursorPosition.y && 
             pos.z === this.cursorPosition.z;
    });
  }

  /**
   * Get items at cursor position
   */
  getItemsAtCursor(): Entity[] {
    return this.itemManager.getItemsAt(this.ecsWorld, this.cursorPosition);
  }

  /**
   * Update the list of available contextual actions
   */
  private updateAvailableActions(): void {
    if (!this.playerEntity) {
      this.availableActions = [];
      return;
    }
    
    const context: ActionContext = {
      targetPosition: this.cursorPosition,
      playerEntity: this.playerEntity,
      ecsWorld: this.ecsWorld,
      world: this.world,
      itemManager: this.itemManager,
      fovSystem: this.fovSystem,
      physicsSystem: this.physicsSystem
    };
    
    this.lastContext = context;
    this.availableActions = getAvailableActions(context);
  }

  /**
   * Get currently available actions
   */
  getAvailableActions(): ContextualAction[] {
    return this.availableActions;
  }

  /**
   * Execute an action by its hotkey
   * Returns true if the action was executed and look mode should end
   */
  async executeActionByHotkey(hotkey: string): Promise<boolean> {
    const action = this.availableActions.find(a => a.hotkey === hotkey);
    if (!action || !this.lastContext) return false;
    
    const result = await action.execute(this.lastContext);
    
    this.eventBus.emit('look:actionExecuted', {
      actionId: action.id,
      hotkey,
      position: this.cursorPosition
    });
    
    return result;
  }

  /**
   * Execute an action by its number
   * Returns true if the action was executed and look mode should end
   */
  async executeActionByNumber(number: number): Promise<boolean> {
    const action = this.availableActions.find(a => a.number === number);
    if (!action || !this.lastContext) return false;
    
    const result = await action.execute(this.lastContext);
    
    this.eventBus.emit('look:actionExecuted', {
      actionId: action.id,
      number,
      position: this.cursorPosition
    });
    
    return result;
  }

  /**
   * Get the sidebar width
   */
  getSidebarWidth(): number {
    return this.config.sidebarWidth;
  }

  /**
   * Get description for a specific action
   */
  getActionDescription(action: ContextualAction): string {
    if (!this.lastContext) return '';
    return action.getDescription?.(this.lastContext) ?? '';
  }
}

export default LookMode;
