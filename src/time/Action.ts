/**
 * Action definitions and types
 */

import { EntityId } from '../ecs';
import { ACTION_COSTS } from '../config/ActionCosts';

// Speed-based actor interface for rot.js
export interface Actor {
  entityId: EntityId;
  getSpeed(): number;
  act(): Promise<void> | void;
}

// Action cost configuration
export interface ActionCost {
  baseCost: number;
  speedFactor?: number;
}

// Action types
export enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  CRAFT = 'craft',
  WAIT = 'wait',
  INTERACT = 'interact',
  PICKUP = 'pickup',
  DROP = 'drop',
  ASCEND = 'ascend',
  DESCEND = 'descend'
}

// Action definition
export class Action {
  readonly type: ActionType;
  readonly cost: number;
  readonly data: Record<string, unknown>;

  constructor(type: ActionType, cost: number, data: Record<string, unknown> = {}) {
    this.type = type;
    this.cost = cost;
    this.data = data;
  }

  static createMoveAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.MOVE * 100) / speed);
    return new Action(ActionType.MOVE, cost);
  }

  static createAttackAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.ATTACK * 100) / speed);
    return new Action(ActionType.ATTACK, cost);
  }

  static createWaitAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.WAIT * 100) / speed);
    return new Action(ActionType.WAIT, cost);
  }

  static createCraftAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.CRAFT * 100) / speed);
    return new Action(ActionType.CRAFT, cost);
  }

  static createInteractAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.INTERACT * 100) / speed);
    return new Action(ActionType.INTERACT, cost);
  }

  static createPickupAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.PICKUP * 100) / speed);
    return new Action(ActionType.PICKUP, cost);
  }

  static createDropAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.DROP * 100) / speed);
    return new Action(ActionType.DROP, cost);
  }

  static createAscendAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.ASCEND * 100) / speed);
    return new Action(ActionType.ASCEND, cost);
  }

  static createDescendAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.DESCEND * 100) / speed);
    return new Action(ActionType.DESCEND, cost);
  }
}
