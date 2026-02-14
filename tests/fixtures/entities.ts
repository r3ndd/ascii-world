/**
 * Entity factory for testing
 * Provides convenient functions to create test entities with components
 */

import { ECSWorld, Entity, createPosition, createHealth, createSpeed, createActor, createRenderable } from '../../src/ecs';

/**
 * Create a basic test entity in the given world
 */
export function createTestEntity(world: ECSWorld, components: any[] = []): Entity {
  const entity = world.createEntity();
  components.forEach(component => entity.addComponent(component));
  return entity;
}

/**
 * Create an entity with standard actor components
 */
export function createTestActor(
  world: ECSWorld,
  options: {
    x?: number;
    y?: number;
    health?: number;
    maxHealth?: number;
    speed?: number;
    isPlayer?: boolean;
    char?: string;
    fg?: string;
  } = {}
): Entity {
  const entity = world.createEntity();
  
  entity
    .addComponent(createPosition(options.x ?? 0, options.y ?? 0))
    .addComponent(createHealth(options.health ?? 100, options.maxHealth ?? 100))
    .addComponent(createSpeed(options.speed ?? 100))
    .addComponent(createActor(options.isPlayer ?? false))
    .addComponent(createRenderable(options.char ?? '@', options.fg ?? '#ffffff'));
  
  return entity;
}

/**
 * Create a player entity with all standard components
 */
export function createTestPlayer(
  world: ECSWorld,
  options: {
    x?: number;
    y?: number;
    health?: number;
    speed?: number;
  } = {}
): Entity {
  return createTestActor(world, {
    ...options,
    isPlayer: true,
    char: '@',
    fg: '#00ff00',
  });
}

/**
 * Create an NPC entity
 */
export function createTestNPC(
  world: ECSWorld,
  options: {
    x?: number;
    y?: number;
    health?: number;
    speed?: number;
    char?: string;
    fg?: string;
  } = {}
): Entity {
  return createTestActor(world, {
    ...options,
    isPlayer: false,
  });
}
