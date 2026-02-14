/**
 * AI Behaviors
 * 
 * Concrete behavior tree nodes for game-specific actions.
 * These implement the core AI behaviors like movement, combat, and sensing.
 * 
 * GOAP Compatibility Design:
 * - Each action can report preconditions and effects
 * - Actions are stateless and reusable
 * - Cost can be calculated dynamically
 * - World state is read from blackboard/memory
 */

import { Entity } from '../ecs';
import { Direction, Position } from '../core/Types';
import { Pathfinding } from '../physics/Pathfinding';
import { 
  Action, 
  Condition, 
  BehaviorContext, 
  NodeStatus
} from './BehaviorTree';
import { 
  MemorySystem, 
  EntityMemory, 
  RelationshipType
} from './MemorySystem';

/**
 * Blackboard keys for AI state
 */
export const BBKeys = {
  // Targeting
  TARGET_ENTITY: 'targetEntity',
  TARGET_POSITION: 'targetPosition',
  LAST_KNOWN_TARGET_POS: 'lastKnownTargetPos',
  
  // Combat
  IN_COMBAT: 'inCombat',
  SHOULD_FLEE: 'shouldFlee',
  ATTACK_COOLDOWN: 'attackCooldown',
  
  // Movement
  CURRENT_PATH: 'currentPath',
  PATH_INDEX: 'pathIndex',
  WANDER_TARGET: 'wanderTarget',
  STUCK_COUNTER: 'stuckCounter',
  
  // Memory
  MEMORY_SYSTEM: 'memorySystem',
  
  // Sensing
  NEARBY_ENTITIES: 'nearbyEntities',
  VISIBLE_THREATS: 'visibleThreats',
  VISIBLE_ALLIES: 'visibleAllies',
  
  // Patrol
  PATROL_POINTS: 'patrolPoints',
  PATROL_INDEX: 'patrolIndex',
  PATROL_DIRECTION: 'patrolDirection', // 1 or -1
} as const;

// ============================================================================
// Movement Actions
// ============================================================================

/**
 * Move in a random direction
 */
export class MoveRandom extends Action {
  private directions: Direction[] = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];

  tick(context: BehaviorContext): NodeStatus {
    const dir = this.directions[Math.floor(Math.random() * this.directions.length)];
    const success = context.physics.moveEntity(context.entity, dir);
    
    return success ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

/**
 * Move toward a target position
 */
export class MoveToTarget extends Action {
  private pathfinding: Pathfinding;

  constructor(pathfinding: Pathfinding) {
    super();
    this.pathfinding = pathfinding;
  }

  tick(context: BehaviorContext): NodeStatus {
    const targetPos = context.blackboard.get<{ x: number; y: number }>(BBKeys.TARGET_POSITION);
    if (!targetPos) return NodeStatus.FAILURE;

    const pos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!pos) return NodeStatus.FAILURE;

    // Check if already at target
    if (pos.x === targetPos.x && pos.y === targetPos.y) {
      context.blackboard.delete(BBKeys.CURRENT_PATH);
      return NodeStatus.SUCCESS;
    }

    // Get or calculate path
    let path = context.blackboard.get<Position[]>(BBKeys.CURRENT_PATH);
    
    if (!path || path.length === 0) {
      // Calculate new path
      const newPath = this.pathfinding.findPath(pos.x, pos.y, targetPos.x, targetPos.y);
      
      if (!newPath || newPath.length === 0) {
        return NodeStatus.FAILURE;
      }
      
      path = newPath;
      context.blackboard.set(BBKeys.CURRENT_PATH, path);
      context.blackboard.set(BBKeys.PATH_INDEX, 0);
    }

    // Follow path
    const pathIndex = context.blackboard.getOrDefault(BBKeys.PATH_INDEX, 0);
    
    if (pathIndex >= path.length) {
      context.blackboard.delete(BBKeys.CURRENT_PATH);
      return NodeStatus.SUCCESS;
    }

    const nextStep = path[pathIndex];
    const dir = this.calculateDirection(pos.x, pos.y, nextStep.x, nextStep.y);
    
    if (!dir) {
      // Path is blocked or invalid, recalculate next tick
      context.blackboard.delete(BBKeys.CURRENT_PATH);
      return NodeStatus.FAILURE;
    }

    const success = context.physics.moveEntity(context.entity, dir);
    
    if (success) {
      context.blackboard.set(BBKeys.PATH_INDEX, pathIndex + 1);
      return NodeStatus.RUNNING; // Still moving toward target
    } else {
      // Movement failed, might be blocked
      const stuckCounter = context.blackboard.getOrDefault(BBKeys.STUCK_COUNTER, 0);
      context.blackboard.set(BBKeys.STUCK_COUNTER, stuckCounter + 1);
      
      if (stuckCounter > 3) {
        // Stuck for too long, abandon path
        context.blackboard.delete(BBKeys.CURRENT_PATH);
        context.blackboard.delete(BBKeys.STUCK_COUNTER);
        return NodeStatus.FAILURE;
      }
      
      return NodeStatus.RUNNING;
    }
  }

  private calculateDirection(fromX: number, fromY: number, toX: number, toY: number): Direction | null {
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (dx === 0 && dy === -1) return 'north';
    if (dx === 0 && dy === 1) return 'south';
    if (dx === 1 && dy === 0) return 'east';
    if (dx === -1 && dy === 0) return 'west';
    if (dx === 1 && dy === -1) return 'northeast';
    if (dx === -1 && dy === -1) return 'northwest';
    if (dx === 1 && dy === 1) return 'southeast';
    if (dx === -1 && dy === 1) return 'southwest';

    return null;
  }

  reset(): void {
    // Path clearing happens in tick when complete
  }
}

/**
 * Follow a patrol path
 */
export class Patrol extends Action {
  tick(context: BehaviorContext): NodeStatus {
    const patrolPoints = context.blackboard.get<Array<{ x: number; y: number }>>(BBKeys.PATROL_POINTS);
    if (!patrolPoints || patrolPoints.length === 0) return NodeStatus.FAILURE;

    let patrolIndex = context.blackboard.getOrDefault(BBKeys.PATROL_INDEX, 0);
    let patrolDirection = context.blackboard.getOrDefault(BBKeys.PATROL_DIRECTION, 1);

    const currentTarget = patrolPoints[patrolIndex];
    context.blackboard.set(BBKeys.TARGET_POSITION, currentTarget);

    const pos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!pos) return NodeStatus.FAILURE;

    // Check if reached patrol point
    if (pos.x === currentTarget.x && pos.y === currentTarget.y) {
      // Move to next patrol point
      patrolIndex += patrolDirection;

      // Handle ping-pong or loop
      if (patrolIndex >= patrolPoints.length) {
        patrolIndex = patrolPoints.length - 2;
        patrolDirection = -1;
      } else if (patrolIndex < 0) {
        patrolIndex = 1;
        patrolDirection = 1;
      }

      context.blackboard.set(BBKeys.PATROL_INDEX, patrolIndex);
      context.blackboard.set(BBKeys.PATROL_DIRECTION, patrolDirection);
    }

    // Return running to continue patrol
    return NodeStatus.RUNNING;
  }
}

/**
 * Move away from a target (flee)
 */
export class MoveAway extends Action {
  tick(context: BehaviorContext): NodeStatus {
    const threatPos = context.blackboard.get<{ x: number; y: number }>(BBKeys.TARGET_POSITION);
    if (!threatPos) return NodeStatus.FAILURE;

    const pos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!pos) return NodeStatus.FAILURE;

    // Calculate direction away from threat
    const dx = pos.x - threatPos.x;
    const dy = pos.y - threatPos.y;

    // Normalize and pick best direction
    let bestDir: Direction | null = null;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      bestDir = dx > 0 ? 'east' : 'west';
    } else {
      bestDir = dy > 0 ? 'south' : 'north';
    }

    if (bestDir) {
      const success = context.physics.moveEntity(context.entity, bestDir);
      if (success) return NodeStatus.SUCCESS;
    }

    // If primary direction failed, try random
    const dirs: Direction[] = ['north', 'south', 'east', 'west'];
    for (const dir of dirs.sort(() => Math.random() - 0.5)) {
      if (context.physics.moveEntity(context.entity, dir)) {
        return NodeStatus.SUCCESS;
      }
    }

    return NodeStatus.FAILURE;
  }
}

// ============================================================================
// Combat Actions
// ============================================================================

/**
 * Attack the current target
 */
export class AttackTarget extends Action {
  tick(context: BehaviorContext): NodeStatus {
    const target = context.blackboard.get<Entity>(BBKeys.TARGET_ENTITY);
    if (!target) return NodeStatus.FAILURE;

    // Check if in range (adjacent for melee)
    const myPos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    const targetPos = target.getComponent<{ type: 'position'; x: number; y: number }>('position');

    if (!myPos || !targetPos) return NodeStatus.FAILURE;

    const distance = Math.abs(myPos.x - targetPos.x) + Math.abs(myPos.y - targetPos.y);
    
    if (distance > 1) {
      // Not in range, move closer
      context.blackboard.set(BBKeys.TARGET_POSITION, { x: targetPos.x, y: targetPos.y });
      return NodeStatus.FAILURE; // Let MoveToTarget handle it
    }

    // Perform attack (this would integrate with combat system)
    // For now, just succeed to indicate attack was attempted
    return NodeStatus.SUCCESS;
  }
}

/**
 * Check if can attack target
 */
export class CanAttackTarget extends Condition {
  check(context: BehaviorContext): boolean {
    const target = context.blackboard.get<Entity>(BBKeys.TARGET_ENTITY);
    if (!target) return false;

    const myPos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    const targetPos = target.getComponent<{ type: 'position'; x: number; y: number }>('position');

    if (!myPos || !targetPos) return false;

    const distance = Math.abs(myPos.x - targetPos.x) + Math.abs(myPos.y - targetPos.y);
    return distance <= 1; // Melee range
  }
}

// ============================================================================
// Sensory Conditions
// ============================================================================

/**
 * Check if any hostile entities are visible
 */
export class CanSeeHostile extends Condition {
  check(context: BehaviorContext): boolean {
    const memorySystem = context.blackboard.get<MemorySystem>(BBKeys.MEMORY_SYSTEM);
    if (!memorySystem) return false;

    const hostiles = memorySystem.getHostileEntities();
    return hostiles.some(mem => mem.data.isVisible);
  }
}

/**
 * Check if health is low
 */
export class IsHealthLow extends Condition {
  private threshold: number;

  constructor(threshold: number = 0.3) {
    super();
    this.threshold = threshold;
  }

  check(context: BehaviorContext): boolean {
    const health = context.entity.getComponent<{ type: 'health'; current: number; max: number }>('health');
    if (!health) return false;

    return health.current / health.max < this.threshold;
  }
}

/**
 * Check if has a target
 */
export class HasTarget extends Condition {
  check(context: BehaviorContext): boolean {
    return context.blackboard.has(BBKeys.TARGET_ENTITY);
  }
}

/**
 * Check if at target position
 */
export class IsAtTarget extends Condition {
  check(context: BehaviorContext): boolean {
    const targetPos = context.blackboard.get<{ x: number; y: number }>(BBKeys.TARGET_POSITION);
    if (!targetPos) return false;

    const pos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!pos) return false;

    return pos.x === targetPos.x && pos.y === targetPos.y;
  }
}

// ============================================================================
// Memory Actions
// ============================================================================

/**
 * Scan for entities and update memory
 */
export class ScanForEntities extends Action {
  // Vision range stored for future FOV integration
  private visionRange: number;

  constructor(visionRange: number = 8) {
    super();
    this.visionRange = visionRange;
  }

  tick(_context: BehaviorContext): NodeStatus {
    // This would integrate with FOV system
    // Vision range stored for future use
    void this.visionRange;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Update target from memory
 */
export class UpdateTargetFromMemory extends Action {
  private relationship: RelationshipType;

  constructor(relationship: RelationshipType = RelationshipType.HOSTILE) {
    super();
    this.relationship = relationship;
  }

  tick(context: BehaviorContext): NodeStatus {
    const memorySystem = context.blackboard.get<MemorySystem>(BBKeys.MEMORY_SYSTEM);
    if (!memorySystem) return NodeStatus.FAILURE;

    const memories = memorySystem.getMemoriesByRelationship(this.relationship);
    
    // Find the closest visible threat
    const myPos = context.entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!myPos) return NodeStatus.FAILURE;

    let closest: EntityMemory | null = null;
    let closestDist = Infinity;

    for (const memory of memories) {
      if (!memory.data.isVisible || !memory.data.lastKnownPosition) continue;

      const pos = memory.data.lastKnownPosition;
      const dist = Math.abs(myPos.x - pos.x) + Math.abs(myPos.y - pos.y);

      if (dist < closestDist) {
        closestDist = dist;
        closest = memory;
      }
    }

    if (closest) {
      context.blackboard.set(BBKeys.TARGET_ENTITY, closest.data.entityId);
      context.blackboard.set(BBKeys.TARGET_POSITION, closest.data.lastKnownPosition);
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.FAILURE;
  }
}

// ============================================================================
// Utility Actions
// ============================================================================

/**
 * Clear current path
 */
export class ClearPath extends Action {
  tick(context: BehaviorContext): NodeStatus {
    context.blackboard.delete(BBKeys.CURRENT_PATH);
    context.blackboard.delete(BBKeys.PATH_INDEX);
    return NodeStatus.SUCCESS;
  }
}

/**
 * Clear target
 */
export class ClearTarget extends Action {
  tick(context: BehaviorContext): NodeStatus {
    context.blackboard.delete(BBKeys.TARGET_ENTITY);
    context.blackboard.delete(BBKeys.TARGET_POSITION);
    return NodeStatus.SUCCESS;
  }
}

/**
 * Set blackboard value
 */
export class SetBlackboardValue<T> extends Action {
  private key: string;
  private value: T;

  constructor(key: string, value: T) {
    super();
    this.key = key;
    this.value = value;
  }

  tick(context: BehaviorContext): NodeStatus {
    context.blackboard.set(this.key, this.value);
    return NodeStatus.SUCCESS;
  }
}
