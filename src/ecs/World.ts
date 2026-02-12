/**
 * ECS World - manages entities and systems
 */

import { EventBus } from '../core/EventBus';
import { EntityId } from '../core/Types';
import { Entity } from './Entity';
import { System, Query } from './System';
import { PositionComponent } from './Component';

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

  getEntitiesAtPosition(x: number, y: number, z: number = 0): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      const position = entity.getComponent<PositionComponent>('position');
      if (position && position.x === x && position.y === y && position.z === z) {
        results.push(entity);
      }
    }
    return results;
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
