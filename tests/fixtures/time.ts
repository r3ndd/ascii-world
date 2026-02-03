/**
 * Time/Turn system factory for testing
 * Provides functions to create test time-related objects
 */

import { TurnManager, SpeedSystem, PostHocUpdateQueue, DeferredUpdateSystem } from '../../src/time';
import { ECSWorld } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';

/**
 * Create a test turn manager
 */
export function createTestTurnManager(
  ecsWorld: ECSWorld,
  eventBus: EventBus
): TurnManager {
  const speedSystem = new SpeedSystem();
  return new TurnManager(ecsWorld, eventBus, speedSystem);
}

/**
 * Create a test speed system
 */
export function createTestSpeedSystem(): SpeedSystem {
  return new SpeedSystem();
}

/**
 * Create a test deferred update queue
 */
export function createTestDeferredUpdateQueue(eventBus: EventBus): PostHocUpdateQueue {
  return new PostHocUpdateQueue(eventBus);
}

/**
 * Create a test deferred update system
 */
export function createTestDeferredUpdateSystem(
  ecsWorld: ECSWorld,
  eventBus: EventBus
): DeferredUpdateSystem {
  return new DeferredUpdateSystem(ecsWorld, eventBus);
}
