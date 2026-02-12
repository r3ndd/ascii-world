/**
 * Speed System
 * Calculates action costs based on actor speed
 */

import { ACTION_COSTS } from '../config/ActionCosts';
import { ActionType } from './Action';

export class SpeedSystem {
  private baseSpeed: number = 100;

  getBaseSpeed(): number {
    return this.baseSpeed;
  }

  calculateActionCost(baseCost: number, speed: number): number {
    // Speed 100: Normal (1 tick per standard action)
    // Speed 50: Slow (2 ticks per standard action)
    // Speed 200: Fast (0.5 ticks per standard action)
    return Math.round((baseCost * this.baseSpeed) / speed);
  }

  getActionTicks(actionType: ActionType, speed: number): number {
    const baseCost = ACTION_COSTS[actionType.toUpperCase() as keyof typeof ACTION_COSTS] || 100;
    return this.calculateActionCost(baseCost, speed);
  }
}
