/**
 * AI System
 * 
 * Main ECS system for AI processing. Integrates behavior trees with the ECS,
 * manages memory systems, and coordinates AI updates.
 * 
 * GOAP Compatibility Design:
 * - System supports multiple decision backends (BT, GOAP, or hybrid)
 * - Behaviors can be swapped dynamically
 * - Planning data is stored in blackboard
 * - Actions are modular and reusable
 */

import { Entity, ECSWorld, BaseSystem } from '../ecs';
import { PhysicsSystem } from '../physics';
import { Pathfinding } from '../physics/Pathfinding';
import { EventBus } from '../core/EventBus';
import { BehaviorTree } from './BehaviorTree';
import { MemorySystem, MemoryManager } from './MemorySystem';
import { BBKeys } from './AIBehaviors';

/**
 * AI component - marks an entity as AI-controlled
 */
export interface AIComponent {
  type: 'ai';
  behaviorTree?: BehaviorTree;
  memorySystem?: MemorySystem;
}

/**
 * Behavior tree registry
 * Maps behavior names to tree factories
 */
export type BehaviorTreeFactory = (entity: Entity) => BehaviorTree;

/**
 * AISystem - ECS system for AI processing
 * 
 * This system:
 * - Updates behavior trees each frame
 * - Manages memory systems
 * - Integrates with the turn system via blackboard
 */
export class AISystem extends BaseSystem {
  readonly name = 'AISystem';
  readonly priority = 20; // Run before ActorSystem
  query = { all: ['ai', 'position'] };

  private ecsWorld: ECSWorld;
  private physicsSystem: PhysicsSystem;
  private pathfinding: Pathfinding;
  private eventBus: EventBus;
  private memoryManager: MemoryManager;
  private behaviorRegistry: Map<string, BehaviorTreeFactory> = new Map();

  constructor(
    ecsWorld: ECSWorld,
    physicsSystem: PhysicsSystem,
    pathfinding: Pathfinding,
    eventBus: EventBus
  ) {
    super();
    this.ecsWorld = ecsWorld;
    this.physicsSystem = physicsSystem;
    this.pathfinding = pathfinding;
    this.eventBus = eventBus;
    this.memoryManager = new MemoryManager();
  }

  /**
   * Get the pathfinding system for use by behavior trees
   */
  getPathfinding(): Pathfinding {
    return this.pathfinding;
  }

  /**
   * Register a behavior tree factory
   */
  registerBehavior(name: string, factory: BehaviorTreeFactory): void {
    this.behaviorRegistry.set(name, factory);
  }

  /**
   * Get a registered behavior factory
   */
  getBehavior(name: string): BehaviorTreeFactory | undefined {
    return this.behaviorRegistry.get(name);
  }

  /**
   * Assign a behavior tree to an entity
   */
  assignBehavior(entity: Entity, behaviorName: string): boolean {
    const factory = this.behaviorRegistry.get(behaviorName);
    if (!factory) return false;

    const ai = entity.getComponent<AIComponent>('ai');
    if (!ai) return false;

    ai.behaviorTree = factory(entity);
    return true;
  }

  /**
   * Set a custom behavior tree on an entity
   */
  setBehaviorTree(entity: Entity, tree: BehaviorTree): void {
    const ai = entity.getComponent<AIComponent>('ai');
    if (ai) {
      ai.behaviorTree = tree;
    }
  }

  /**
   * Called when an entity with AI is added
   */
  onEntityAdded(entity: Entity): void {
    const ai = entity.getComponent<AIComponent>('ai');
    if (!ai) return;

    // Create memory system for this entity
    ai.memorySystem = this.memoryManager.getSystem(entity);

    // Initialize blackboard with memory system reference
    if (ai.behaviorTree) {
      const blackboard = ai.behaviorTree.getBlackboard();
      blackboard.set(BBKeys.MEMORY_SYSTEM, ai.memorySystem);
    }

    // Emit event
    this.eventBus.emit('ai:entityAdded', { entityId: entity.id });
  }

  /**
   * Called when an AI entity is removed
   */
  onEntityRemoved(entity: Entity): void {
    // Cleanup memory system
    this.memoryManager.removeSystem(entity.id);

    // Emit event
    this.eventBus.emit('ai:entityRemoved', { entityId: entity.id });
  }

  /**
   * Update all AI entities
   */
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const ai = entity.getComponent<AIComponent>('ai');
      if (!ai?.behaviorTree) continue;

      // Update the behavior tree
      const status = ai.behaviorTree.tick({
        physics: this.physicsSystem,
        deltaTime,
      });

      // Emit status event for debugging
      this.eventBus.emit('ai:tick', {
        entityId: entity.id,
        status,
      });
    }
  }

  /**
   * Process memory decay for all entities
   * Should be called each turn
   */
  processMemoryDecay(): void {
    this.memoryManager.processAllDecay();
  }

  /**
   * Set the global turn counter for all memory systems
   */
  setGlobalTurn(turn: number): void {
    this.memoryManager.setGlobalTurn(turn);
  }

  /**
   * Get the memory system for an entity
   */
  getMemorySystem(entity: Entity): MemorySystem | undefined {
    return this.memoryManager.getSystem(entity);
  }

  /**
   * Create or update entity memory
   */
  rememberEntity(
    observer: Entity,
    targetId: number,
    relationship: string,
    options: {
      position?: { x: number; y: number; z?: number };
      health?: number;
    } = {}
  ): void {
    const memorySystem = this.getMemorySystem(observer);
    if (!memorySystem) return;

    // Get target entity
    const target = this.ecsWorld.getEntity(targetId);
    if (!target) return;

    const health = options.health ?? target.getComponent<{ type: 'health'; current: number }>('health')?.current;

    memorySystem.rememberEntity(targetId, relationship as any, {
      position: options.position,
      health,
    });
  }

  /**
   * Clear all AI data
   */
  clear(): void {
    this.memoryManager.clear();
    this.behaviorRegistry.clear();
  }
}

/**
 * Create AI component factory
 */
export function createAI(behaviorTree?: BehaviorTree): AIComponent {
  return {
    type: 'ai',
    behaviorTree,
  };
}

/**
 * Pre-built behavior tree presets
 */
export const BehaviorPresets = {
  /**
   * Wander behavior - moves randomly
   */
  WANDER: 'wander',

  /**
   * Hunter behavior - seeks and attacks hostile targets
   */
  HUNTER: 'hunter',

  /**
   * Patrol behavior - follows patrol points
   */
  PATROL: 'patrol',

  /**
   * Coward behavior - flees from threats
   */
  COWARD: 'coward',

  /**
   * Neutral behavior - wanders, avoids combat
   */
  NEUTRAL: 'neutral',
} as const;

export type BehaviorPreset = typeof BehaviorPresets[keyof typeof BehaviorPresets];
