/**
 * Behavior Tree System
 * 
 * Core behavior tree implementation designed with extensibility in mind.
 * Future GOAP integration is supported through:
 * - Shared Blackboard system for state
 * - Abstract Action interface that can wrap both BT nodes and GOAP actions
 * - Modular design allowing different decision backends
 */

import { Entity } from '../ecs';
import { PhysicsSystem } from '../physics';

/**
 * Node execution status
 */
export enum NodeStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  RUNNING = 'running',
}

/**
 * Blackboard - shared memory for behavior tree nodes
 * Provides a flexible key-value store with type safety
 * 
 * Design for GOAP compatibility:
 * - World state can be stored here for planner
 * - Actions can read/write world state
 * - Supports both simple values and complex objects
 */
export class Blackboard {
  private data: Map<string, unknown> = new Map();
  private entity: Entity;

  constructor(entity: Entity) {
    this.entity = entity;
  }

  /**
   * Get the entity this blackboard belongs to
   */
  getEntity(): Entity {
    return this.entity;
  }

  /**
   * Set a value in the blackboard
   */
  set<T>(key: string, value: T): void {
    this.data.set(key, value);
  }

  /**
   * Get a value from the blackboard
   */
  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  /**
   * Get a value with a default
   */
  getOrDefault<T>(key: string, defaultValue: T): T {
    const value = this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Check if a condition is met (for GOAP world state checking)
   */
  isConditionMet(key: string, expectedValue: unknown): boolean {
    const actualValue = this.get(key);
    return JSON.stringify(actualValue) === JSON.stringify(expectedValue);
  }
}

/**
 * Context passed to nodes during execution
 * Contains all systems needed for AI decision-making
 */
export interface BehaviorContext {
  entity: Entity;
  blackboard: Blackboard;
  physics: PhysicsSystem;
  deltaTime: number;
}

/**
 * Abstract base class for all behavior tree nodes
 * 
 * Architecture designed for GOAP compatibility:
 * - tick() method can be overridden for different execution models
 * - Nodes can be composed into sequences (like GOAP action sequences)
 * - Supports interruption and resumption (important for real-time GOAP replanning)
 */
export abstract class BTNode {
  abstract tick(context: BehaviorContext): NodeStatus;

  /**
   * Called when the node starts execution (entering from parent)
   * Override to initialize state
   */
  onEnter(_context: BehaviorContext): void {
    // Override in subclasses
  }

  /**
   * Called when the node finishes execution (success or failure)
   * Override to cleanup state
   */
  onExit(_context: BehaviorContext, _status: NodeStatus): void {
    // Override in subclasses
  }

  /**
   * Reset the node to initial state
   */
  reset(): void {
    // Override in subclasses
  }
}

/**
 * Composite node - has multiple children
 */
export abstract class Composite extends BTNode {
  protected children: BTNode[] = [];
  protected currentIndex = 0;

  addChild(child: BTNode): this {
    this.children.push(child);
    return this;
  }

  removeChild(child: BTNode): boolean {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  getChildren(): readonly BTNode[] {
    return this.children;
  }

  reset(): void {
    this.currentIndex = 0;
    for (const child of this.children) {
      child.reset();
    }
  }

  onEnter(context: BehaviorContext): void {
    this.currentIndex = 0;
    for (const child of this.children) {
      child.onEnter(context);
    }
  }
}

/**
 * Sequence - executes children in order until one fails
 * Succeeds only if all children succeed
 */
export class Sequence extends Composite {
  tick(context: BehaviorContext): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const status = child.tick(context);

      if (status === NodeStatus.FAILURE) {
        this.currentIndex = 0;
        return NodeStatus.FAILURE;
      }

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }

      // Child succeeded, move to next
      this.currentIndex++;
    }

    // All children succeeded
    this.currentIndex = 0;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Selector - executes children in order until one succeeds
 * Fails only if all children fail
 */
export class Selector extends Composite {
  tick(context: BehaviorContext): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const status = child.tick(context);

      if (status === NodeStatus.SUCCESS) {
        this.currentIndex = 0;
        return NodeStatus.SUCCESS;
      }

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }

      // Child failed, move to next
      this.currentIndex++;
    }

    // All children failed
    this.currentIndex = 0;
    return NodeStatus.FAILURE;
  }
}

/**
 * Parallel - executes all children simultaneously
 * Succeeds/Fails based on policy
 */
export enum ParallelPolicy {
  REQUIRE_ALL_SUCCESS = 'require_all_success',
  REQUIRE_ONE_SUCCESS = 'require_one_success',
  REQUIRE_ALL_FAILURE = 'require_all_failure',
  REQUIRE_ONE_FAILURE = 'require_one_failure',
}

export class Parallel extends Composite {
  private successPolicy: ParallelPolicy;
  private failurePolicy: ParallelPolicy;
  private childStatuses: Map<BTNode, NodeStatus> = new Map();

  constructor(
    successPolicy: ParallelPolicy = ParallelPolicy.REQUIRE_ALL_SUCCESS,
    failurePolicy: ParallelPolicy = ParallelPolicy.REQUIRE_ONE_FAILURE
  ) {
    super();
    this.successPolicy = successPolicy;
    this.failurePolicy = failurePolicy;
  }

  tick(context: BehaviorContext): NodeStatus {
    let successCount = 0;
    let failureCount = 0;

    for (const child of this.children) {
      let status = this.childStatuses.get(child);
      
      // Only tick running children or children not yet started
      if (status === undefined || status === NodeStatus.RUNNING) {
        status = child.tick(context);
        this.childStatuses.set(child, status);
      }

      if (status === NodeStatus.SUCCESS) successCount++;
      else if (status === NodeStatus.FAILURE) failureCount++;
    }

    // Check success policy
    if (this.checkPolicy(this.successPolicy, successCount, failureCount)) {
      this.reset();
      return NodeStatus.SUCCESS;
    }

    // Check failure policy
    if (this.checkPolicy(this.failurePolicy, successCount, failureCount)) {
      this.reset();
      return NodeStatus.FAILURE;
    }

    return NodeStatus.RUNNING;
  }

  private checkPolicy(
    policy: ParallelPolicy,
    successCount: number,
    failureCount: number
  ): boolean {
    const total = this.children.length;

    switch (policy) {
      case ParallelPolicy.REQUIRE_ALL_SUCCESS:
        return successCount === total;
      case ParallelPolicy.REQUIRE_ONE_SUCCESS:
        return successCount > 0;
      case ParallelPolicy.REQUIRE_ALL_FAILURE:
        return failureCount === total;
      case ParallelPolicy.REQUIRE_ONE_FAILURE:
        return failureCount > 0;
      default:
        return false;
    }
  }

  reset(): void {
    super.reset();
    this.childStatuses.clear();
  }
}

/**
 * Decorator - has a single child
 */
export abstract class Decorator extends BTNode {
  protected child: BTNode | null = null;

  setChild(child: BTNode): this {
    this.child = child;
    return this;
  }

  getChild(): BTNode | null {
    return this.child;
  }

  reset(): void {
    this.child?.reset();
  }
}

/**
 * Inverter - inverts the child's result
 */
export class Inverter extends Decorator {
  tick(context: BehaviorContext): NodeStatus {
    if (!this.child) return NodeStatus.FAILURE;

    const status = this.child.tick(context);

    if (status === NodeStatus.SUCCESS) return NodeStatus.FAILURE;
    if (status === NodeStatus.FAILURE) return NodeStatus.SUCCESS;
    return NodeStatus.RUNNING;
  }
}

/**
 * Succeeder - always returns success regardless of child's result
 */
export class Succeeder extends Decorator {
  tick(context: BehaviorContext): NodeStatus {
    if (!this.child) return NodeStatus.SUCCESS;

    this.child.tick(context);
    return NodeStatus.SUCCESS;
  }
}

/**
 * Failer - always returns failure regardless of child's result
 */
export class Failer extends Decorator {
  tick(context: BehaviorContext): NodeStatus {
    if (!this.child) return NodeStatus.FAILURE;

    this.child.tick(context);
    return NodeStatus.FAILURE;
  }
}

/**
 * Repeater - repeats the child a specified number of times or indefinitely
 */
export class Repeater extends Decorator {
  private maxRepeats: number;
  private currentCount = 0;

  constructor(maxRepeats: number = -1) {
    super();
    this.maxRepeats = maxRepeats; // -1 = infinite
  }

  tick(context: BehaviorContext): NodeStatus {
    if (!this.child) return NodeStatus.FAILURE;

    const status = this.child.tick(context);

    if (status !== NodeStatus.RUNNING) {
      this.currentCount++;
      
      if (this.maxRepeats > 0 && this.currentCount >= this.maxRepeats) {
        this.currentCount = 0;
        return NodeStatus.SUCCESS;
      }

      // Reset child for next iteration
      this.child.reset();
      this.child.onEnter(context);
    }

    return NodeStatus.RUNNING;
  }

  reset(): void {
    super.reset();
    this.currentCount = 0;
  }
}

/**
 * UntilFail - repeats until child fails
 */
export class UntilFail extends Decorator {
  tick(context: BehaviorContext): NodeStatus {
    if (!this.child) return NodeStatus.FAILURE;

    const status = this.child.tick(context);

    if (status === NodeStatus.FAILURE) {
      return NodeStatus.SUCCESS;
    }

    if (status === NodeStatus.SUCCESS) {
      this.child.reset();
      this.child.onEnter(context);
    }

    return NodeStatus.RUNNING;
  }
}

/**
 * Behavior Tree - main container for a behavior tree
 * 
 * Design note: This wrapper allows for future extension with:
 * - GOAP planner backend (can swap root node with plan)
 * - Dynamic tree modification
 * - Tree serialization/deserialization
 */
export class BehaviorTree {
  private root: BTNode;
  private blackboard: Blackboard;
  private entity: Entity;

  constructor(root: BTNode, entity: Entity) {
    this.root = root;
    this.entity = entity;
    this.blackboard = new Blackboard(entity);
  }

  /**
   * Tick the behavior tree
   * Returns the status of the root node
   */
  tick(context: Omit<BehaviorContext, 'blackboard' | 'entity'>): NodeStatus {
    const fullContext: BehaviorContext = {
      ...context,
      entity: this.entity,
      blackboard: this.blackboard,
    };

    return this.root.tick(fullContext);
  }

  /**
   * Get the blackboard for this tree
   */
  getBlackboard(): Blackboard {
    return this.blackboard;
  }

  /**
   * Get the root node
   */
  getRoot(): BTNode {
    return this.root;
  }

  /**
   * Set a new root node
   * Useful for dynamic behavior switching or GOAP integration
   */
  setRoot(newRoot: BTNode): void {
    this.root = newRoot;
  }

  /**
   * Reset the entire tree
   */
  reset(): void {
    this.root.reset();
  }
}

/**
 * Action - base class for leaf nodes that perform actions
 * 
 * GOAP Compatibility:
 * - This can be extended to include preconditions and effects
 * - Actions can be serialized and used by a GOAP planner
 * - Cost can be added for planning purposes
 */
export abstract class Action extends BTNode {
  /**
   * Cost of this action (for future GOAP planning)
   * Lower cost = preferred action
   */
  getCost(): number {
    return 1;
  }
}

/**
 * Condition - base class for leaf nodes that check conditions
 */
export abstract class Condition extends BTNode {
  /**
   * Evaluate the condition
   * Should return SUCCESS if condition is met, FAILURE otherwise
   */
  abstract check(context: BehaviorContext): boolean;

  tick(context: BehaviorContext): NodeStatus {
    return this.check(context) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

/**
 * Wait action - does nothing for a duration or indefinitely
 */
export class Wait extends Action {
  private duration: number;
  private elapsed = 0;

  constructor(duration: number = -1) {
    super();
    this.duration = duration; // -1 = indefinite (wait for interrupt)
  }

  tick(context: BehaviorContext): NodeStatus {
    this.elapsed += context.deltaTime;

    if (this.duration > 0 && this.elapsed >= this.duration) {
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.RUNNING;
  }

  reset(): void {
    this.elapsed = 0;
  }
}
