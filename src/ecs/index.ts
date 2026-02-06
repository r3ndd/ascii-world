/**
 * Entity Component System - Core ECS implementation
 */

import { EventBus } from '../core/EventBus';

// Re-export from core types
import { EntityId } from '../core/Types';
export { EntityId };

// Base component interface
export interface Component {
  readonly type: string;
}

// Component constructor type
export type ComponentConstructor<T extends Component> = new (...args: unknown[]) => T;

// Entity class
export class Entity {
  private static nextId: number = 1;
  readonly id: EntityId;
  private components: Map<string, Component> = new Map();

  constructor() {
    this.id = Entity.nextId++;
  }

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  removeComponent(componentType: string): boolean {
    return this.components.delete(componentType);
  }

  getComponent<T extends Component>(componentType: string): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  hasComponent(componentType: string): boolean {
    return this.components.has(componentType);
  }

  hasComponents(...componentTypes: string[]): boolean {
    return componentTypes.every(type => this.components.has(type));
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }
}

// Query for filtering entities
export interface Query {
  all?: string[];
  any?: string[];
  none?: string[];
}

// System interface
export interface System {
  readonly name: string;
  readonly priority: number;
  query: Query;
  update(entities: Entity[], deltaTime: number): void;
  onEntityAdded?(entity: Entity): void;
  onEntityRemoved?(entity: Entity): void;
}

// ECS World - manages entities and systems
export class ECSWorld {
  private entities: Map<EntityId, Entity> = new Map();
  private systems: System[] = [];
  private eventBus: EventBus;
  private entityQueryCache: Map<string, Entity[]> = new Map();
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;

  constructor(eventBus: EventBus = new EventBus()) {
    this.eventBus = eventBus;
  }

  createEntity(): Entity {
    const entity = new Entity();
    this.entities.set(entity.id, entity);
    this.invalidateCache();
    this.eventBus.emit('ecs:entityCreated', { entityId: entity.id });
    return entity;
  }

  removeEntity(entityId: EntityId): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    // Notify systems
    this.systems.forEach(system => {
      if (system.onEntityRemoved) {
        system.onEntityRemoved(entity);
      }
    });

    this.entities.delete(entityId);
    this.invalidateCache();
    this.eventBus.emit('ecs:entityRemoved', { entityId });
    return true;
  }

  getEntity(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  queryEntities(query: Query): Entity[] {
    const cacheKey = this.queryToCacheKey(query);
    if (this.entityQueryCache.has(cacheKey)) {
      return this.entityQueryCache.get(cacheKey)!;
    }

    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (this.matchesQuery(entity, query)) {
        results.push(entity);
      }
    }

    this.entityQueryCache.set(cacheKey, results);
    return results;
  }

  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    
    // Notify system of existing matching entities
    const matchingEntities = this.queryEntities(system.query);
    if (system.onEntityAdded) {
      matchingEntities.forEach(entity => system.onEntityAdded!(entity));
    }
  }

  removeSystem(systemName: string): boolean {
    const index = this.systems.findIndex(s => s.name === systemName);
    if (index > -1) {
      this.systems.splice(index, 1);
      return true;
    }
    return false;
  }

  update(deltaTime: number): void {
    if (!this.isRunning) return;

    for (const system of this.systems) {
      const entities = this.queryEntities(system.query);
      system.update(entities, deltaTime);
    }

    this.lastUpdateTime += deltaTime;
  }

  start(): void {
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
  }

  stop(): void {
    this.isRunning = false;
  }

  clear(): void {
    this.entities.clear();
    this.systems = [];
    this.invalidateCache();
  }

  private matchesQuery(entity: Entity, query: Query): boolean {
    // Check 'all' - entity must have all these components
    if (query.all && !entity.hasComponents(...query.all)) {
      return false;
    }

    // Check 'any' - entity must have at least one of these components
    if (query.any && !query.any.some(type => entity.hasComponent(type))) {
      return false;
    }

    // Check 'none' - entity must not have any of these components
    if (query.none && query.none.some(type => entity.hasComponent(type))) {
      return false;
    }

    return true;
  }

  private queryToCacheKey(query: Query): string {
    const parts: string[] = [];
    if (query.all) parts.push(`all:${query.all.join(',')}`);
    if (query.any) parts.push(`any:${query.any.join(',')}`);
    if (query.none) parts.push(`none:${query.none.join(',')}`);
    return parts.join('|');
  }

  invalidateCache(): void {
    this.entityQueryCache.clear();
  }
}

// Base system class for convenience
export abstract class BaseSystem implements System {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract query: Query;
  
  abstract update(entities: Entity[], deltaTime: number): void;
  
  onEntityAdded?(entity: Entity): void;
  onEntityRemoved?(entity: Entity): void;
}

// Common components
export interface PositionComponent extends Component {
  type: 'position';
  x: number;
  y: number;
  z: number;  // Layer/elevation
}

export interface VelocityComponent extends Component {
  type: 'velocity';
  vx: number;
  vy: number;
}

export interface HealthComponent extends Component {
  type: 'health';
  current: number;
  max: number;
}

export interface SpeedComponent extends Component {
  type: 'speed';
  value: number;  // 100 = normal
}

export interface ActorComponent extends Component {
  type: 'actor';
  isPlayer: boolean;
  energy: number;
  nextAction?: string;
}

export interface RenderableComponent extends Component {
  type: 'renderable';
  char: string;
  fg: string;
  bg?: string;
}

// Component factories
export function createPosition(x: number, y: number, z: number = 0): PositionComponent {
  return { type: 'position', x, y, z };
}

export function createVelocity(vx: number, vy: number): VelocityComponent {
  return { type: 'velocity', vx, vy };
}

export function createHealth(current: number, max: number): HealthComponent {
  return { type: 'health', current, max };
}

export function createSpeed(value: number): SpeedComponent {
  return { type: 'speed', value };
}

export function createActor(isPlayer: boolean = false): ActorComponent {
  return { type: 'actor', isPlayer, energy: 0 };
}

export function createRenderable(char: string, fg: string, bg?: string): RenderableComponent {
  return { type: 'renderable', char, fg, bg };
}
