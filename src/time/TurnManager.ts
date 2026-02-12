/**
 * Turn Manager
 * Using rot.js Scheduler.Speed for turn-based gameplay
 */

import * as ROT from 'rot-js';
import { Entity, EntityId, ECSWorld } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Direction } from '../core/Types';
import { Actor } from './Action';
import { ActorSystem, PlayerBehavior, NPCBehavior, ActorBehavior } from './ActorSystem';
import { SpeedSystem } from './SpeedSystem';

// Actor wrapper for rot.js scheduler
class ActorWrapper implements Actor {
  entityId: EntityId;
  private entity: Entity;
  private actorSystem: ActorSystem;

  constructor(entity: Entity, actorSystem: ActorSystem) {
    this.entityId = entity.id;
    this.entity = entity;
    this.actorSystem = actorSystem;
  }

  getSpeed(): number {
    return this.actorSystem.getSpeed(this.entity);
  }

  act(): Promise<void> | void {
    return this.actorSystem.act(this.entity);
  }
}

export class TurnManager {
  private scheduler: InstanceType<typeof ROT.Scheduler.Speed<Actor>>;
  private eventBus: EventBus;
  private isRunning: boolean = false;
  private currentTurn: number = 0;
  private ecsWorld: ECSWorld;
  private actorSystem: ActorSystem;
  private actorWrappers: Map<EntityId, ActorWrapper> = new Map();
  private playerEntityId: EntityId | null = null;

  constructor(ecsWorld: ECSWorld, eventBus: EventBus, _speedSystem: SpeedSystem, actorSystem: ActorSystem) {
    this.scheduler = new ROT.Scheduler.Speed<Actor>();
    this.eventBus = eventBus;
    this.ecsWorld = ecsWorld;
    this.actorSystem = actorSystem;

    // Register for entity creation/removal events
    this.eventBus.on('ecs:entityCreated', ({ entityId }: { entityId: EntityId }) => {
      this.handleEntityCreated(entityId);
    });

    this.eventBus.on('ecs:entityRemoved', ({ entityId }: { entityId: EntityId }) => {
      this.handleEntityRemoved(entityId);
    });

    // Scan for existing actors
    this.scanForActors();
  }

  private scanForActors(): void {
    const actors = this.ecsWorld.queryEntities({ all: ['actor', 'speed'] });
    for (const entity of actors) {
      this.registerActorEntity(entity);
    }
  }

  private handleEntityCreated(entityId: EntityId): void {
    // Check immediately - if components are already added, great
    // If not, the entity will be picked up by scanForNewActors later
    const entity = this.ecsWorld.getEntity(entityId);
    if (entity && entity.hasComponents('actor', 'speed')) {
      this.registerActorEntity(entity);
    }
  }

  /**
   * Scan for any new actors that were added since last scan.
   * Call this after creating entities to ensure they're registered.
   */
  scanForNewActors(): void {
    const actors = this.ecsWorld.queryEntities({ all: ['actor', 'speed'] });
    for (const entity of actors) {
      if (!this.actorWrappers.has(entity.id)) {
        this.registerActorEntity(entity);
      }
    }
  }

  private handleEntityRemoved(entityId: EntityId): void {
    const wrapper = this.actorWrappers.get(entityId);
    if (wrapper) {
      this.scheduler.remove(wrapper);
      this.actorWrappers.delete(entityId);
      
      if (this.playerEntityId === entityId) {
        this.playerEntityId = null;
      }
      
      this.eventBus.emit('turn:actorRemoved', { entityId });
    }
  }

  private registerActorEntity(entity: Entity): void {
    const wrapper = new ActorWrapper(entity, this.actorSystem);
    this.actorWrappers.set(entity.id, wrapper);
    this.scheduler.add(wrapper, true); // Repeat = true

    const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
    const isPlayer = actor?.isPlayer ?? false;

    if (isPlayer) {
      this.playerEntityId = entity.id;
    }

    this.eventBus.emit('turn:actorRegistered', { entityId: entity.id, isPlayer });
  }

  setPlayerInputHandler(handler: () => Promise<{ direction?: Direction; wait?: boolean }>): void {
    this.actorSystem.setPlayerInputHandler(handler);
  }

  getPlayerEntity(): Entity | undefined {
    return this.playerEntityId ? this.ecsWorld.getEntity(this.playerEntityId) : undefined;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.eventBus.emit('turn:started', { turn: this.currentTurn });
    
    while (this.isRunning) {
      await this.processNextTurn();
    }
  }

  stop(): void {
    this.isRunning = false;
    this.eventBus.emit('turn:stopped', { turn: this.currentTurn });
  }

  async processNextTurn(): Promise<void> {
    const actor = this.scheduler.next() as Actor | null;
    
    if (!actor) {
      console.warn('No actors in scheduler');
      return;
    }

    const isPlayerTurn = actor.entityId === this.playerEntityId;
    
    this.eventBus.emit('turn:begin', { 
      entityId: actor.entityId, 
      turn: this.currentTurn,
      isPlayer: isPlayerTurn
    });

    try {
      await actor.act();
    } catch (error) {
      console.error(`Error during actor ${actor.entityId} turn:`, error);
      this.eventBus.emit('turn:error', { entityId: actor.entityId, error });
    }

    this.currentTurn++;
    
    this.eventBus.emit('turn:end', { 
      entityId: actor.entityId, 
      turn: this.currentTurn,
      isPlayer: isPlayerTurn
    });
  }

  processSingleTurn(): Promise<void> {
    return this.processNextTurn();
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  isPlayerTurn(): boolean {
    const nextActor = this.scheduler.next();
    if (nextActor) {
      // Put it back - this is a bit hacky but needed to peek
      // The scheduler doesn't have a peek method, so we rely on the callback
      return nextActor.entityId === this.playerEntityId;
    }
    return false;
  }

  pause(): void {
    this.isRunning = false;
  }

  resume(): void {
    if (!this.isRunning) {
      this.start();
    }
  }
}

// Re-export ActorSystem classes for backward compatibility
export { ActorSystem, PlayerBehavior, NPCBehavior };
export type { ActorBehavior };
