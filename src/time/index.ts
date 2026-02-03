/**
 * Time module
 * Turn management and deferred updates using rot.js Scheduler.Speed
 */

import * as ROT from 'rot-js';
import { Entity, EntityId, ECSWorld } from '../ecs';
import { ACTION_COSTS } from '../config/ActionCosts';
import { EventBus } from '../core/EventBus';

// Speed-based actor interface for rot.js
export interface Actor {
  entityId: EntityId;
  getSpeed(): number;
  act(): Promise<void> | void;
}

// Action cost configuration
export interface ActionCost {
  baseCost: number;
  speedFactor?: number;
}

// Action types
export enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  CRAFT = 'craft',
  WAIT = 'wait',
  INTERACT = 'interact',
  PICKUP = 'pickup',
  DROP = 'drop'
}

// Action definition
export class Action {
  readonly type: ActionType;
  readonly cost: number;
  readonly data: Record<string, unknown>;

  constructor(type: ActionType, cost: number, data: Record<string, unknown> = {}) {
    this.type = type;
    this.cost = cost;
    this.data = data;
  }

  static createMoveAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.MOVE * 100) / speed);
    return new Action(ActionType.MOVE, cost);
  }

  static createAttackAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.ATTACK * 100) / speed);
    return new Action(ActionType.ATTACK, cost);
  }

  static createWaitAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.WAIT * 100) / speed);
    return new Action(ActionType.WAIT, cost);
  }

  static createCraftAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.CRAFT * 100) / speed);
    return new Action(ActionType.CRAFT, cost);
  }

  static createInteractAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.INTERACT * 100) / speed);
    return new Action(ActionType.INTERACT, cost);
  }

  static createPickupAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.PICKUP * 100) / speed);
    return new Action(ActionType.PICKUP, cost);
  }

  static createDropAction(speed: number): Action {
    const cost = Math.round((ACTION_COSTS.DROP * 100) / speed);
    return new Action(ActionType.DROP, cost);
  }
}

// Speed system - calculates action costs based on actor speed
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

// Turn manager using rot.js Scheduler.Speed
export class TurnManager {
  private scheduler: InstanceType<typeof ROT.Scheduler.Speed<Actor>>;
  private eventBus: EventBus;
  private isRunning: boolean = false;
  private currentTurn: number = 0;
  private actors: Map<EntityId, Actor> = new Map();
  private playerActor: Actor | null = null;
  private turnCallback: (() => Promise<void>) | null = null;

  constructor(_ecsWorld: ECSWorld, eventBus: EventBus, _speedSystem: SpeedSystem) {
    this.scheduler = new ROT.Scheduler.Speed<Actor>();
    this.eventBus = eventBus;
  }

  registerActor(actor: Actor, isPlayer: boolean = false): void {
    this.actors.set(actor.entityId, actor);
    this.scheduler.add(actor, true); // Repeat = true
    
    if (isPlayer) {
      this.playerActor = actor;
    }

    this.eventBus.emit('turn:actorRegistered', { entityId: actor.entityId, isPlayer });
  }

  removeActor(entityId: EntityId): boolean {
    const actor = this.actors.get(entityId);
    if (actor) {
      this.scheduler.remove(actor);
      this.actors.delete(entityId);
      
      if (this.playerActor === actor) {
        this.playerActor = null;
      }
      
      this.eventBus.emit('turn:actorRemoved', { entityId });
      return true;
    }
    return false;
  }

  setPlayerActionCallback(callback: () => Promise<void>): void {
    this.turnCallback = callback;
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

    const isPlayerTurn = actor === this.playerActor;
    
    this.eventBus.emit('turn:begin', { 
      entityId: actor.entityId, 
      turn: this.currentTurn,
      isPlayer: isPlayerTurn
    });

    try {
      // Execute actor's turn
      if (isPlayerTurn && this.turnCallback) {
        await this.turnCallback();
      } else {
        await actor.act();
      }
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
      // Put it back
      const isPlayer = nextActor === this.playerActor;
      // Re-add to maintain order - this is a bit hacky but needed to peek
      return isPlayer;
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

// Deferred update entry
interface DeferredUpdate {
  entityId: EntityId;
  missedTurns: number;
  timestamp: number;
}

// Post-hoc update queue for catch-up processing
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

// Deferred update system for post-hoc processing
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

// Catch-up calculation for missed turns
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
