/**
 * Deferred Update System
 * Handles post-hoc catch-up processing for entities
 */

import { EntityId, ECSWorld } from '../ecs';
import { EventBus } from '../core/EventBus';
import { PostHocUpdateQueue } from './PostHocUpdateQueue';
import { CatchUpCalculator } from './CatchUpCalculator';

export class DeferredUpdateSystem {
  private queue: PostHocUpdateQueue;
  private ecsWorld: ECSWorld;
  private eventBus: EventBus;

  constructor(ecsWorld: ECSWorld, eventBus: EventBus) {
    this.ecsWorld = ecsWorld;
    this.eventBus = eventBus;
    this.queue = new PostHocUpdateQueue(eventBus);
  }

  queueCatchUp(entityId: EntityId, missedTurns: number): void {
    this.queue.queueEntity(entityId, missedTurns);
  }

  processCatchUp(entityId: EntityId, missedTurns: number): void {
    const entity = this.ecsWorld.getEntity(entityId);
    if (!entity) return;

    const actor = entity.getComponent('actor');
    const health = entity.getComponent('health') as { type: 'health'; current: number; max: number } | undefined;
    const speed = entity.getComponent('speed') as { type: 'speed'; value: number } | undefined;

    if (!actor || !health || !speed) return;

    // Calculate effects over missed turns
    // This is a simplified version - in reality you'd have more complex simulation
    const catchUpResults = CatchUpCalculator.calculate(entity, missedTurns, speed.value);

    // Apply accumulated effects
    health.current = Math.max(0, Math.min(health.max, health.current + catchUpResults.healthDelta));
    
    // Generate summary for player if needed
    if (catchUpResults.events.length > 0) {
      this.eventBus.emit('deferred:catchUpComplete', {
        entityId,
        missedTurns,
        events: catchUpResults.events
      });
    }
  }

  processAll(): void {
    this.queue.processQueue((update) => {
      this.processCatchUp(update.entityId, update.missedTurns);
    });
  }

  getQueue(): PostHocUpdateQueue {
    return this.queue;
  }
}
