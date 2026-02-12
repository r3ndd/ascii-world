/**
 * Post-Hoc Update Queue
 * Queue for deferred/catch-up processing
 */

import { EntityId } from '../ecs';
import { EventBus } from '../core/EventBus';

// Deferred update entry
export interface DeferredUpdate {
  entityId: EntityId;
  missedTurns: number;
  timestamp: number;
}

export class PostHocUpdateQueue {
  private queue: DeferredUpdate[] = [];
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  queueEntity(entityId: EntityId, missedTurns: number): void {
    this.queue.push({
      entityId,
      missedTurns,
      timestamp: Date.now()
    });
    
    this.eventBus.emit('deferred:entityQueued', { entityId, missedTurns });
  }

  processQueue(processor: (update: DeferredUpdate) => void): void {
    while (this.queue.length > 0) {
      const update = this.queue.shift()!;
      processor(update);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
