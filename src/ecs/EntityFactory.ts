/**
 * Entity factories for creating common game entities
 * 
 * Note: This file must not import from './index' to avoid circular dependencies.
 * Import directly from the source files or use type imports.
 */

import type { Position } from '../core/Types';
import type { Entity, ECSWorld } from './index';

export interface PlayerOptions {
  position?: Position;
  char?: string;
  fg?: string;
  bg?: string;
  maxHealth?: number;
  speed?: number;
  name?: string;
}

export interface NPCOptions {
  position?: Position;
  char?: string;
  fg?: string;
  bg?: string;
  maxHealth?: number;
  speed?: number;
  name?: string;
  aiType?: 'random' | 'hostile' | 'neutral';
}

// Component factory functions (duplicated here to avoid circular imports)
function createPosition(x: number, y: number, z: number = 0) {
  return { type: 'position' as const, x, y, z };
}

function createRenderable(char: string, fg: string, bg?: string) {
  return { type: 'renderable' as const, char, fg, bg };
}

function createActor(isPlayer: boolean = false) {
  return { type: 'actor' as const, isPlayer, energy: 0 };
}

function createHealth(current: number, max: number) {
  return { type: 'health' as const, current, max };
}

function createSpeed(value: number) {
  return { type: 'speed' as const, value };
}

export class EntityFactory {
  static createPlayer(ecsWorld: ECSWorld, options: PlayerOptions = {}): Entity {
    const entity = ecsWorld.createEntity();
    
    const pos = options.position ?? { x: 500, y: 500, z: 0 };
    const char = options.char ?? '@';
    const fg = options.fg ?? '#ffff00';
    const bg = options.bg;
    const maxHealth = options.maxHealth ?? 100;
    const speed = options.speed ?? 100;
    
    entity
      .addComponent(createPosition(pos.x, pos.y, pos.z))
      .addComponent(createRenderable(char, fg, bg))
      .addComponent(createActor(true))
      .addComponent(createHealth(maxHealth, maxHealth))
      .addComponent(createSpeed(speed));
    
    return entity;
  }
  
  static createNPC(ecsWorld: ECSWorld, options: NPCOptions = {}): Entity {
    const entity = ecsWorld.createEntity();
    
    const pos = options.position ?? { x: 500, y: 500, z: 0 };
    const char = options.char ?? 'n';
    const fg = options.fg ?? '#ff0000';
    const bg = options.bg;
    const maxHealth = options.maxHealth ?? 50;
    const speed = options.speed ?? 80;
    const aiType = options.aiType ?? 'random';
    
    entity
      .addComponent(createPosition(pos.x, pos.y, pos.z))
      .addComponent(createRenderable(char, fg, bg))
      .addComponent(createActor(false))
      .addComponent(createHealth(maxHealth, maxHealth))
      .addComponent(createSpeed(speed));
    
    // Store AI type as a component data extension
    const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
    if (actor) {
      (actor as any).aiType = aiType;
    }
    
    return entity;
  }
}

export { EntityFactory as default };
