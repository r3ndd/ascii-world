/**
 * Memory System
 * 
 * Tracks memories for AI entities including:
 * - Entity memories (other actors, threats, allies)
 * - Location memories (points of interest, dangerous areas)
 * - Event memories (combat, interactions, discoveries)
 * 
 * Design for GOAP compatibility:
 * - Memories represent world state observations
 * - Can be used to check preconditions
 * - Support for memory-derived goals (revenge, exploration)
 */

import { Entity, EntityId } from '../ecs';

/**
 * Memory importance levels
 */
export enum MemoryImportance {
  TRIVIAL = 1,    // Will forget quickly
  LOW = 2,
  NORMAL = 3,
  HIGH = 5,       // Significant event
  CRITICAL = 10,  // Life-threatening, never forget
}

/**
 * Types of memories
 */
export enum MemoryType {
  ENTITY = 'entity',      // Another entity
  LOCATION = 'location',  // A specific location
  EVENT = 'event',        // Something that happened
  ITEM = 'item',          // An item seen or obtained
  TERRAIN = 'terrain',    // Terrain feature
}

/**
 * Relationship types between entities
 */
export enum RelationshipType {
  HOSTILE = 'hostile',
  FRIENDLY = 'friendly',
  NEUTRAL = 'neutral',
  AFRAID = 'afraid',
  CURIOUS = 'curious',
  ALLIED = 'allied',
}

/**
 * Base memory structure
 */
export interface Memory {
  id: string;
  type: MemoryType;
  importance: MemoryImportance;
  timestamp: number;       // When this memory was formed
  lastUpdated: number;     // Last time this memory was reinforced
  confidence: number;      // 0-1, how certain the AI is about this memory
  decayRate: number;       // How fast this memory fades per turn
  data: unknown;           // Type-specific data
}

/**
 * Entity memory - tracks another entity
 */
export interface EntityMemory extends Memory {
  type: MemoryType.ENTITY;
  data: {
    entityId: EntityId;
    lastKnownPosition?: { x: number; y: number; z?: number };
    lastKnownHealth?: number;
    relationship: RelationshipType;
    isVisible: boolean;
    threatLevel: number;   // 0-1, calculated threat
    timesEncountered: number;
    lastInteraction?: string;
  };
}

/**
 * Location memory - tracks a point of interest
 */
export interface LocationMemory extends Memory {
  type: MemoryType.LOCATION;
  data: {
    x: number;
    y: number;
    z?: number;
    description: string;
    tags: string[];        // e.g., 'dangerous', 'loot', 'safe'
    timesVisited: number;
    isExplored: boolean;
  };
}

/**
 * Event memory - tracks something that happened
 */
export interface EventMemory extends Memory {
  type: MemoryType.EVENT;
  data: {
    eventType: string;     // e.g., 'combat', 'discovery', 'trade'
    description: string;
    participants: EntityId[];
    location?: { x: number; y: number; z?: number };
    outcome: string;       // e.g., 'victory', 'defeat', 'escaped'
  };
}

/**
 * Item memory - tracks items seen or obtained
 */
export interface ItemMemory extends Memory {
  type: MemoryType.ITEM;
  data: {
    itemId: string;
    itemName: string;
    location?: { x: number; y: number; z?: number };
    isObtained: boolean;
    isEquipped: boolean;
  };
}

/**
 * Terrain memory - tracks terrain features
 */
export interface TerrainMemory extends Memory {
  type: MemoryType.TERRAIN;
  data: {
    x: number;
    y: number;
    z?: number;
    terrainType: string;
    isPassable: boolean;
    isDangerous: boolean;
  };
}

export type AnyMemory = EntityMemory | LocationMemory | EventMemory | ItemMemory | TerrainMemory;

/**
 * Memory system for an entity
 * Manages all memories with decay and retrieval
 */
export class MemorySystem {
  private memories: Map<string, AnyMemory> = new Map();
  private entity: Entity;
  private currentTurn = 0;

  constructor(entity: Entity) {
    this.entity = entity;
  }

  /**
   * Get the entity this memory system belongs to
   */
  getEntity(): Entity {
    return this.entity;
  }

  /**
   * Generate a unique memory ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current turn number
   */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  /**
   * Update the turn counter
   */
  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /**
   * Add a new memory
   */
  addMemory(memory: Omit<AnyMemory, 'id' | 'timestamp' | 'lastUpdated'>): AnyMemory {
    const newMemory: AnyMemory = {
      ...memory,
      id: this.generateId(),
      timestamp: this.currentTurn,
      lastUpdated: this.currentTurn,
    } as AnyMemory;

    this.memories.set(newMemory.id, newMemory);
    return newMemory;
  }

  /**
   * Update an existing memory
   */
  updateMemory(id: string, updates: Partial<AnyMemory>): AnyMemory | undefined {
    const memory = this.memories.get(id);
    if (!memory) return undefined;

    const updated: AnyMemory = {
      ...memory,
      ...updates,
      lastUpdated: this.currentTurn,
    } as AnyMemory;

    this.memories.set(id, updated);
    return updated;
  }

  /**
   * Reinforce a memory (increase confidence, reset decay)
   */
  reinforceMemory(id: string): void {
    const memory = this.memories.get(id);
    if (!memory) return;

    memory.confidence = Math.min(1, memory.confidence + 0.1);
    memory.lastUpdated = this.currentTurn;
    memory.importance = Math.min(MemoryImportance.CRITICAL, memory.importance + 1);
  }

  /**
   * Remove a memory
   */
  removeMemory(id: string): boolean {
    return this.memories.delete(id);
  }

  /**
   * Get a memory by ID
   */
  getMemory(id: string): AnyMemory | undefined {
    return this.memories.get(id);
  }

  /**
   * Get all memories
   */
  getAllMemories(): AnyMemory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Get memories by type
   */
  getMemoriesByType<T extends AnyMemory>(type: MemoryType): T[] {
    return Array.from(this.memories.values()).filter(
      (m): m is T => m.type === type
    );
  }

  /**
   * Get entity memories
   */
  getEntityMemories(): EntityMemory[] {
    return this.getMemoriesByType<EntityMemory>(MemoryType.ENTITY);
  }

  /**
   * Get memory for a specific entity
   */
  getMemoryForEntity(entityId: EntityId): EntityMemory | undefined {
    return this.getEntityMemories().find(m => m.data.entityId === entityId);
  }

  /**
   * Get memories by relationship type
   */
  getMemoriesByRelationship(relationship: RelationshipType): EntityMemory[] {
    return this.getEntityMemories().filter(m => m.data.relationship === relationship);
  }

  /**
   * Get hostile entities in memory
   */
  getHostileEntities(): EntityMemory[] {
    return this.getMemoriesByRelationship(RelationshipType.HOSTILE);
  }

  /**
   * Get friendly entities in memory
   */
  getFriendlyEntities(): EntityMemory[] {
    return this.getMemoriesByRelationship(RelationshipType.FRIENDLY);
  }

  /**
   * Get most recent memories
   */
  getRecentMemories(count: number): AnyMemory[] {
    return this.getAllMemories()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  /**
   * Get most important memories
   */
  getImportantMemories(count: number): AnyMemory[] {
    return this.getAllMemories()
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
  }

  /**
   * Process memory decay
   * Should be called each turn
   */
  processDecay(): void {
    const memoriesToRemove: string[] = [];

    for (const [id, memory] of this.memories) {
      // Calculate age in turns
      const age = this.currentTurn - memory.lastUpdated;
      
      // Apply decay based on importance
      // Higher importance = slower decay
      const decayAmount = memory.decayRate * age / memory.importance;
      
      // Reduce confidence
      memory.confidence = Math.max(0, memory.confidence - decayAmount);

      // Remove if confidence too low and not critical
      if (memory.confidence <= 0.1 && memory.importance < MemoryImportance.HIGH) {
        memoriesToRemove.push(id);
      }
    }

    // Remove forgotten memories
    for (const id of memoriesToRemove) {
      this.memories.delete(id);
    }
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
  }

  /**
   * Get memory count
   */
  getMemoryCount(): number {
    return this.memories.size;
  }

  /**
   * Check if has memory of entity
   */
  hasMemoryOfEntity(entityId: EntityId): boolean {
    return this.getEntityMemories().some(m => m.data.entityId === entityId);
  }

  /**
   * Create or update entity memory
   */
  rememberEntity(
    entityId: EntityId,
    relationship: RelationshipType,
    options: {
      position?: { x: number; y: number; z?: number };
      health?: number;
      threatLevel?: number;
      importance?: MemoryImportance;
    } = {}
  ): EntityMemory {
    const existing = this.getMemoryForEntity(entityId);

    if (existing) {
      // Update existing memory
      this.reinforceMemory(existing.id);
      
      const updates: Partial<EntityMemory> = {
        data: {
          ...existing.data,
          relationship,
          isVisible: options.position !== undefined,
        },
      };

      if (options.position) {
        updates.data!.lastKnownPosition = options.position;
      }
      if (options.health !== undefined) {
        updates.data!.lastKnownHealth = options.health;
      }
      if (options.threatLevel !== undefined) {
        updates.data!.threatLevel = options.threatLevel;
      }

      const updated = this.updateMemory(existing.id, updates);
      return updated! as EntityMemory;
    } else {
      // Create new memory
      return this.addMemory({
        type: MemoryType.ENTITY,
        importance: options.importance ?? MemoryImportance.NORMAL,
        confidence: 1,
        decayRate: 0.01,
        data: {
          entityId,
          relationship,
          lastKnownPosition: options.position,
          lastKnownHealth: options.health,
          isVisible: options.position !== undefined,
          threatLevel: options.threatLevel ?? 0,
          timesEncountered: 1,
        },
      }) as EntityMemory;
    }
  }

  /**
   * Remember a location
   */
  rememberLocation(
    x: number,
    y: number,
    description: string,
    options: {
      z?: number;
      tags?: string[];
      importance?: MemoryImportance;
    } = {}
  ): LocationMemory {
    return this.addMemory({
      type: MemoryType.LOCATION,
      importance: options.importance ?? MemoryImportance.LOW,
      confidence: 1,
      decayRate: 0.005,
      data: {
        x,
        y,
        z: options.z,
        description,
        tags: options.tags ?? [],
        timesVisited: 1,
        isExplored: false,
      },
    }) as LocationMemory;
  }

  /**
   * Remember an event
   */
  rememberEvent(
    eventType: string,
    description: string,
    options: {
      participants?: EntityId[];
      location?: { x: number; y: number; z?: number };
      outcome?: string;
      importance?: MemoryImportance;
    } = {}
  ): EventMemory {
    return this.addMemory({
      type: MemoryType.EVENT,
      importance: options.importance ?? MemoryImportance.NORMAL,
      confidence: 1,
      decayRate: 0.02,
      data: {
        eventType,
        description,
        participants: options.participants ?? [],
        location: options.location,
        outcome: options.outcome ?? 'unknown',
      },
    }) as EventMemory;
  }

  /**
   * Mark entity as no longer visible
   */
  loseSightOf(entityId: EntityId): void {
    const memory = this.getMemoryForEntity(entityId);
    if (memory) {
      this.updateMemory(memory.id, {
        data: {
          ...memory.data,
          isVisible: false,
        },
      } as Partial<EntityMemory>);
    }
  }

  /**
   * Update entity visibility
   */
  updateEntityVisibility(entityId: EntityId, isVisible: boolean, position?: { x: number; y: number; z?: number }): void {
    const memory = this.getMemoryForEntity(entityId);
    if (memory) {
      const updates: Partial<EntityMemory> = {
        data: {
          ...memory.data,
          isVisible,
        },
      };
      
      if (position) {
        updates.data!.lastKnownPosition = position;
      }

      this.updateMemory(memory.id, updates);
    }
  }

  /**
   * Serialize memories for save/load
   */
  serialize(): AnyMemory[] {
    return this.getAllMemories();
  }

  /**
   * Deserialize memories
   */
  deserialize(data: AnyMemory[]): void {
    this.memories.clear();
    for (const memory of data) {
      this.memories.set(memory.id, memory);
    }
  }
}

/**
 * Global memory manager - tracks all entity memory systems
 */
export class MemoryManager {
  private systems: Map<EntityId, MemorySystem> = new Map();

  /**
   * Get or create memory system for an entity
   */
  getSystem(entity: Entity): MemorySystem {
    const id = entity.id;
    
    if (!this.systems.has(id)) {
      this.systems.set(id, new MemorySystem(entity));
    }

    return this.systems.get(id)!;
  }

  /**
   * Remove memory system for an entity
   */
  removeSystem(entityId: EntityId): boolean {
    return this.systems.delete(entityId);
  }

  /**
   * Process decay for all memory systems
   */
  processAllDecay(): void {
    for (const system of this.systems.values()) {
      system.processDecay();
    }
  }

  /**
   * Update turn for all systems
   */
  setGlobalTurn(turn: number): void {
    for (const system of this.systems.values()) {
      system.setTurn(turn);
    }
  }

  /**
   * Clear all memory systems
   */
  clear(): void {
    this.systems.clear();
  }
}
