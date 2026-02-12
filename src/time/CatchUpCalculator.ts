/**
 * Catch-Up Calculator
 * Calculates effects for missed turns during deferred updates
 */

import { Entity } from '../ecs';

export class CatchUpCalculator {
  static calculate(
    _entity: Entity, 
    missedTurns: number, 
    speed: number
  ): { 
    healthDelta: number; 
    hungerDelta: number; 
    events: string[] 
  } {
    const events: string[] = [];
    let healthDelta = 0;
    let hungerDelta = 0;

    // Calculate regeneration (if applicable)
    // Speed 100 = normal regeneration rate
    const regenRate = Math.floor(missedTurns / (1000 / speed)); // Every X turns based on speed
    if (regenRate > 0) {
      healthDelta += regenRate;
      events.push(`regenerated ${regenRate} health`);
    }

    // Calculate hunger/thirst accumulation
    // Assume 1 hunger per 100 turns at normal speed
    const hungerRate = Math.floor(missedTurns / (100 / speed));
    if (hungerRate > 0) {
      hungerDelta += hungerRate;
      events.push(`grew hungrier (${hungerRate})`);
    }

    return {
      healthDelta,
      hungerDelta,
      events
    };
  }
}
