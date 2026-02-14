/**
 * AI System Tests
 * Tests for behavior trees, memory system, and AI behaviors
 */

import { ECSWorld, createHealth, createAI } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/world';
import { PhysicsSystem } from '../../src/physics';
import { Pathfinding } from '../../src/physics/Pathfinding';
import { createTestNPC } from '../fixtures/entities';
import {
  BehaviorTree,
  Sequence,
  Selector,
  Parallel,
  ParallelPolicy,
  Inverter,
  Succeeder,
  Failer,
  Repeater,
  UntilFail,
  Action,
  Wait,
  Blackboard,
  BehaviorContext,
  NodeStatus,
} from '../../src/ai/BehaviorTree';
import {
  MemorySystem,
  MemoryManager,
  MemoryType,
  MemoryImportance,
  RelationshipType,
} from '../../src/ai/MemorySystem';
import {
  MoveRandom,
  IsHealthLow,
  HasTarget,
  IsAtTarget,
  ClearPath,
  ClearTarget,
  SetBlackboardValue,
  BBKeys,
} from '../../src/ai/AIBehaviors';
import { AISystem } from '../../src/ai/AISystem';

// Mock PhysicsSystem for testing
class MockPhysicsSystem {
  moveEntity = jest.fn().mockReturnValue(true);
  moveEntityTo = jest.fn().mockReturnValue(true);
  canMoveTo = jest.fn().mockReturnValue(true);
}

// Simple test action that always succeeds
class SuccessAction extends Action {
  tick(_context: BehaviorContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }
}

// Simple test action that always fails
class FailureAction extends Action {
  tick(_context: BehaviorContext): NodeStatus {
    return NodeStatus.FAILURE;
  }
}

// Test action that tracks execution count
class CounterAction extends Action {
  public count = 0;
  
  tick(_context: BehaviorContext): NodeStatus {
    this.count++;
    return NodeStatus.SUCCESS;
  }
}

describe('AI System', () => {
  let world: ECSWorld;
  let eventBus: EventBus;
  let mockPhysics: MockPhysicsSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new ECSWorld(eventBus);
    mockPhysics = new MockPhysicsSystem() as unknown as MockPhysicsSystem;
  });

  afterEach(() => {
    world.clear();
  });

  describe('Behavior Tree Core', () => {
    describe('Sequence', () => {
      it('should succeed when all children succeed', () => {
        const sequence = new Sequence()
          .addChild(new SuccessAction())
          .addChild(new SuccessAction())
          .addChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = sequence.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });

      it('should fail when any child fails', () => {
        const sequence = new Sequence()
          .addChild(new SuccessAction())
          .addChild(new FailureAction())
          .addChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = sequence.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });

      it('should execute children in order', () => {
        const action1 = new CounterAction();
        const action2 = new CounterAction();
        const action3 = new CounterAction();

        const sequence = new Sequence()
          .addChild(action1)
          .addChild(action2)
          .addChild(action3);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        sequence.tick(context);

        expect(action1.count).toBe(1);
        expect(action2.count).toBe(1);
        expect(action3.count).toBe(1);
      });
    });

    describe('Selector', () => {
      it('should succeed when any child succeeds', () => {
        const selector = new Selector()
          .addChild(new FailureAction())
          .addChild(new SuccessAction())
          .addChild(new FailureAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = selector.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });

      it('should fail when all children fail', () => {
        const selector = new Selector()
          .addChild(new FailureAction())
          .addChild(new FailureAction())
          .addChild(new FailureAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = selector.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });

      it('should stop after first success', () => {
        const action1 = new FailureAction();
        const action2 = new SuccessAction();
        const action3 = new CounterAction();

        const selector = new Selector()
          .addChild(action1)
          .addChild(action2)
          .addChild(action3);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        selector.tick(context);

        expect(action3.count).toBe(0);
      });
    });

    describe('Parallel', () => {
      it('should succeed when all succeed (REQUIRE_ALL_SUCCESS)', () => {
        const parallel = new Parallel(ParallelPolicy.REQUIRE_ALL_SUCCESS)
          .addChild(new SuccessAction())
          .addChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = parallel.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });

      it('should fail when one fails (REQUIRE_ALL_SUCCESS)', () => {
        const parallel = new Parallel(ParallelPolicy.REQUIRE_ALL_SUCCESS)
          .addChild(new SuccessAction())
          .addChild(new FailureAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = parallel.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });

      it('should succeed when one succeeds (REQUIRE_ONE_SUCCESS)', () => {
        const parallel = new Parallel(ParallelPolicy.REQUIRE_ONE_SUCCESS)
          .addChild(new FailureAction())
          .addChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = parallel.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });
    });

    describe('Decorators', () => {
      it('Inverter should invert SUCCESS to FAILURE', () => {
        const inverter = new Inverter().setChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = inverter.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });

      it('Inverter should invert FAILURE to SUCCESS', () => {
        const inverter = new Inverter().setChild(new FailureAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = inverter.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });

      it('Succeeder should always return SUCCESS', () => {
        const succeeder = new Succeeder().setChild(new FailureAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = succeeder.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
      });

      it('Failer should always return FAILURE', () => {
        const failer = new Failer().setChild(new SuccessAction());

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        const result = failer.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });

      it('Repeater should repeat child specified times', () => {
        const counter = new CounterAction();
        const repeater = new Repeater(3).setChild(counter);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        // First tick starts execution
        let result = repeater.tick(context);
        expect(result).toBe(NodeStatus.RUNNING);
        
        // Continue until done
        let iterations = 0;
        while (result === NodeStatus.RUNNING && iterations < 10) {
          result = repeater.tick(context);
          iterations++;
        }

        expect(result).toBe(NodeStatus.SUCCESS);
        expect(counter.count).toBe(3);
      });

      it('UntilFail should repeat until child fails', () => {
        let callCount = 0;
        const conditionalAction = new (class extends Action {
          tick(_context: BehaviorContext): NodeStatus {
            callCount++;
            return callCount < 3 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
          }
        })();

        const untilFail = new UntilFail().setChild(conditionalAction);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        let result = untilFail.tick(context);
        let iterations = 0;
        while (result === NodeStatus.RUNNING && iterations < 10) {
          result = untilFail.tick(context);
          iterations++;
        }

        expect(result).toBe(NodeStatus.SUCCESS);
        expect(callCount).toBe(3);
      });
    });

    describe('Wait', () => {
      it('should return RUNNING for duration', () => {
        const wait = new Wait(100);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 50,
        };

        expect(wait.tick(context)).toBe(NodeStatus.RUNNING);
        expect(wait.tick(context)).toBe(NodeStatus.SUCCESS);
      });

      it('should run indefinitely when duration is -1', () => {
        const wait = new Wait(-1);

        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 1000,
        };

        for (let i = 0; i < 10; i++) {
          expect(wait.tick(context)).toBe(NodeStatus.RUNNING);
        }
      });
    });
  });

  describe('Blackboard', () => {
    it('should store and retrieve values', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      blackboard.set('key1', 'value1');
      blackboard.set('key2', 42);
      blackboard.set('key3', { nested: true });

      expect(blackboard.get('key1')).toBe('value1');
      expect(blackboard.get('key2')).toBe(42);
      expect(blackboard.get('key3')).toEqual({ nested: true });
    });

    it('should return undefined for non-existent keys', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      expect(blackboard.get('nonexistent')).toBeUndefined();
    });

    it('should return default value with getOrDefault', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      expect(blackboard.getOrDefault('nonexistent', 'default')).toBe('default');
    });

    it('should check if key exists', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      blackboard.set('exists', true);

      expect(blackboard.has('exists')).toBe(true);
      expect(blackboard.has('notexists')).toBe(false);
    });

    it('should delete keys', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      blackboard.set('key', 'value');
      expect(blackboard.delete('key')).toBe(true);
      expect(blackboard.has('key')).toBe(false);
      expect(blackboard.delete('key')).toBe(false);
    });

    it('should clear all keys', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      blackboard.set('key1', 1);
      blackboard.set('key2', 2);
      blackboard.clear();

      expect(blackboard.has('key1')).toBe(false);
      expect(blackboard.has('key2')).toBe(false);
    });

    it('should check conditions', () => {
      const entity = createTestNPC(world);
      const blackboard = new Blackboard(entity);

      blackboard.set('health', 100);

      expect(blackboard.isConditionMet('health', 100)).toBe(true);
      expect(blackboard.isConditionMet('health', 50)).toBe(false);
      expect(blackboard.isConditionMet('nonexistent', 100)).toBe(false);
    });
  });

  describe('BehaviorTree', () => {
    it('should tick root node and return status', () => {
      const entity = createTestNPC(world);
      const tree = new BehaviorTree(new SuccessAction(), entity);

      const result = tree.tick({
        physics: mockPhysics as unknown as PhysicsSystem,
        deltaTime: 16,
      });

      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it('should provide access to blackboard', () => {
      const entity = createTestNPC(world);
      const tree = new BehaviorTree(new SuccessAction(), entity);

      const blackboard = tree.getBlackboard();
      expect(blackboard).toBeInstanceOf(Blackboard);
    });

    it('should allow setting new root', () => {
      const entity = createTestNPC(world);
      const tree = new BehaviorTree(new FailureAction(), entity);

      expect(tree.tick({
        physics: mockPhysics as unknown as PhysicsSystem,
        deltaTime: 16,
      })).toBe(NodeStatus.FAILURE);

      tree.setRoot(new SuccessAction());

      expect(tree.tick({
        physics: mockPhysics as unknown as PhysicsSystem,
        deltaTime: 16,
      })).toBe(NodeStatus.SUCCESS);
    });

    it('should reset all nodes', () => {
      const counter = new CounterAction();
      const tree = new BehaviorTree(counter, createTestNPC(world));

      tree.tick({ physics: mockPhysics as unknown as PhysicsSystem, deltaTime: 16 });
      expect(counter.count).toBe(1);

      tree.reset();
      // Reset doesn't directly affect action state, but node state
    });
  });

  describe('MemorySystem', () => {
    it('should create entity memory', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      const memory = memorySystem.rememberEntity(1, RelationshipType.HOSTILE, {
        position: { x: 10, y: 10 },
        health: 50,
      });

      expect(memory.type).toBe(MemoryType.ENTITY);
      expect(memory.data.relationship).toBe(RelationshipType.HOSTILE);
      expect(memory.data.entityId).toBe(1);
      expect(memory.data.lastKnownPosition).toEqual({ x: 10, y: 10 });
      expect(memory.data.lastKnownHealth).toBe(50);
    });

    it('should update existing entity memory', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      memorySystem.rememberEntity(1, RelationshipType.NEUTRAL);
      const updated = memorySystem.rememberEntity(1, RelationshipType.HOSTILE, {
        health: 75,
      });

      expect(updated.data.relationship).toBe(RelationshipType.HOSTILE);
      expect(updated.data.lastKnownHealth).toBe(75);
    });

    it('should retrieve memory for entity', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      memorySystem.rememberEntity(1, RelationshipType.FRIENDLY);

      const retrieved = memorySystem.getMemoryForEntity(1);
      expect(retrieved).toBeDefined();
      expect(retrieved?.data.entityId).toBe(1);
    });

    it('should filter memories by relationship', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      memorySystem.rememberEntity(1, RelationshipType.HOSTILE);
      memorySystem.rememberEntity(2, RelationshipType.FRIENDLY);
      memorySystem.rememberEntity(3, RelationshipType.HOSTILE);

      const hostile = memorySystem.getHostileEntities();
      expect(hostile).toHaveLength(2);
      expect(hostile.every(m => m.data.relationship === RelationshipType.HOSTILE)).toBe(true);
    });

    it('should remember locations', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      const location = memorySystem.rememberLocation(5, 10, 'A dangerous cave', {
        tags: ['dangerous', 'explored'],
      });

      expect(location.type).toBe(MemoryType.LOCATION);
      expect(location.data.x).toBe(5);
      expect(location.data.y).toBe(10);
      expect(location.data.description).toBe('A dangerous cave');
      expect(location.data.tags).toContain('dangerous');
    });

    it('should remember events', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      const event = memorySystem.rememberEvent('combat', 'Fought a goblin', {
        participants: [1, 2],
        outcome: 'victory',
        importance: MemoryImportance.HIGH,
      });

      expect(event.type).toBe(MemoryType.EVENT);
      expect(event.data.eventType).toBe('combat');
      expect(event.data.outcome).toBe('victory');
      expect(event.importance).toBe(MemoryImportance.HIGH);
    });

    it('should process memory decay', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);
      memorySystem.setTurn(0);

      memorySystem.rememberEntity(1, RelationshipType.HOSTILE);
      
      // Advance many turns
      memorySystem.setTurn(1000);
      memorySystem.processDecay();

      // Low importance memories should be removed
      expect(memorySystem.hasMemoryOfEntity(1)).toBe(false);
    });

    it('should reinforce memory to prevent decay', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);
      memorySystem.setTurn(0);

      // Create a high importance memory
      const memory = memorySystem.rememberEntity(1, RelationshipType.HOSTILE);
      // Reinforce multiple times to build up confidence and importance
      for (let i = 0; i < 5; i++) {
        memorySystem.reinforceMemory(memory.id);
      }
      
      // Check initial state after reinforcement
      const reinforcedMemory = memorySystem.getMemoryForEntity(1);
      expect(reinforcedMemory).toBeDefined();
      expect(reinforcedMemory!.confidence).toBe(1); // Maxed out at 1
      expect(reinforcedMemory!.importance).toBeGreaterThanOrEqual(MemoryImportance.HIGH);
    });

    it('should track entity visibility', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      const memory = memorySystem.rememberEntity(1, RelationshipType.HOSTILE, {
        position: { x: 10, y: 10 },
      });

      expect(memory.data.isVisible).toBe(true);

      memorySystem.loseSightOf(1);
      const updated = memorySystem.getMemoryForEntity(1);
      expect(updated?.data.isVisible).toBe(false);
    });

    it('should get recent memories', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      memorySystem.rememberLocation(1, 1, 'First');
      memorySystem.setTurn(1);
      memorySystem.rememberLocation(2, 2, 'Second');
      memorySystem.setTurn(2);
      memorySystem.rememberLocation(3, 3, 'Third');

      const recent = memorySystem.getRecentMemories(2);
      expect(recent).toHaveLength(2);
      expect((recent[0].data as { description: string }).description).toBe('Third');
      expect((recent[1].data as { description: string }).description).toBe('Second');
    });

    it('should get important memories', () => {
      const observer = createTestNPC(world);
      const memorySystem = new MemorySystem(observer);

      memorySystem.rememberLocation(1, 1, 'Trivial', { importance: MemoryImportance.TRIVIAL });
      memorySystem.rememberLocation(2, 2, 'Critical', { importance: MemoryImportance.CRITICAL });
      memorySystem.rememberLocation(3, 3, 'Normal', { importance: MemoryImportance.NORMAL });

      const important = memorySystem.getImportantMemories(2);
      expect(important).toHaveLength(2);
      expect((important[0].data as { description: string }).description).toBe('Critical');
      expect((important[1].data as { description: string }).description).toBe('Normal');
    });
  });

  describe('MemoryManager', () => {
    it('should manage multiple entity memory systems', () => {
      const manager = new MemoryManager();
      const entity1 = createTestNPC(world);
      const entity2 = createTestNPC(world);

      const system1 = manager.getSystem(entity1);
      const system2 = manager.getSystem(entity2);

      expect(system1).toBeInstanceOf(MemorySystem);
      expect(system2).toBeInstanceOf(MemorySystem);
      expect(system1).not.toBe(system2);
    });

    it('should return same system for same entity', () => {
      const manager = new MemoryManager();
      const entity = createTestNPC(world);

      const system1 = manager.getSystem(entity);
      const system2 = manager.getSystem(entity);

      expect(system1).toBe(system2);
    });

    it('should remove system for entity', () => {
      const manager = new MemoryManager();
      const entity = createTestNPC(world);

      manager.getSystem(entity);
      expect(manager.removeSystem(entity.id)).toBe(true);
      expect(manager.removeSystem(entity.id)).toBe(false);
    });

    it('should set global turn for all systems', () => {
      const manager = new MemoryManager();
      const entity1 = createTestNPC(world);
      const entity2 = createTestNPC(world);

      manager.getSystem(entity1);
      manager.getSystem(entity2);
      manager.setGlobalTurn(100);

      // Both systems should have turn 100
    });

    it('should process decay for all systems', () => {
      const manager = new MemoryManager();
      const entity1 = createTestNPC(world);
      const entity2 = createTestNPC(world);

      const system1 = manager.getSystem(entity1);
      const system2 = manager.getSystem(entity2);

      system1.setTurn(0);
      system2.setTurn(0);
      system1.rememberEntity(1, RelationshipType.HOSTILE);
      system2.rememberEntity(2, RelationshipType.HOSTILE);

      system1.setTurn(1000);
      system2.setTurn(1000);
      manager.processAllDecay();

      // Memories should be decayed
    });
  });

  describe('AI Behaviors', () => {
    describe('MoveRandom', () => {
      it('should attempt to move in a random direction', () => {
        const moveRandom = new MoveRandom();
        const entity = createTestNPC(world, { x: 10, y: 10 });
        const blackboard = new Blackboard(entity);

        const result = moveRandom.tick({
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        });

        expect(mockPhysics.moveEntity).toHaveBeenCalled();
        expect(result).toBe(NodeStatus.SUCCESS);
      });
    });

    describe('Conditions', () => {
      it('HasTarget should check for target in blackboard', () => {
        const hasTarget = new HasTarget();
        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);

        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        expect(hasTarget.tick(context)).toBe(NodeStatus.FAILURE);

        blackboard.set(BBKeys.TARGET_ENTITY, { id: 1 });
        expect(hasTarget.tick(context)).toBe(NodeStatus.SUCCESS);
      });

      it('IsAtTarget should check position', () => {
        const isAtTarget = new IsAtTarget();
        const entity = createTestNPC(world, { x: 10, y: 10 });
        const blackboard = new Blackboard(entity);

        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        blackboard.set(BBKeys.TARGET_POSITION, { x: 5, y: 5 });
        expect(isAtTarget.tick(context)).toBe(NodeStatus.FAILURE);

        blackboard.set(BBKeys.TARGET_POSITION, { x: 10, y: 10 });
        expect(isAtTarget.tick(context)).toBe(NodeStatus.SUCCESS);
      });

      it('IsHealthLow should check health threshold', () => {
        const isHealthLow = new IsHealthLow(0.3);
        const entity = createTestNPC(world);
        entity.addComponent(createHealth(100, 100));

        const blackboard = new Blackboard(entity);
        const context: BehaviorContext = {
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        };

        expect(isHealthLow.tick(context)).toBe(NodeStatus.FAILURE);

        entity.addComponent(createHealth(25, 100));
        expect(isHealthLow.tick(context)).toBe(NodeStatus.SUCCESS);
      });
    });

    describe('Utility Actions', () => {
      it('ClearPath should remove path from blackboard', () => {
        const clearPath = new ClearPath();
        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);

        blackboard.set(BBKeys.CURRENT_PATH, [{ x: 1, y: 1 }]);
        blackboard.set(BBKeys.PATH_INDEX, 0);

        const result = clearPath.tick({
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        });

        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.has(BBKeys.CURRENT_PATH)).toBe(false);
        expect(blackboard.has(BBKeys.PATH_INDEX)).toBe(false);
      });

      it('ClearTarget should remove target from blackboard', () => {
        const clearTarget = new ClearTarget();
        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);

        blackboard.set(BBKeys.TARGET_ENTITY, { id: 1 });
        blackboard.set(BBKeys.TARGET_POSITION, { x: 10, y: 10 });

        const result = clearTarget.tick({
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        });

        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.has(BBKeys.TARGET_ENTITY)).toBe(false);
        expect(blackboard.has(BBKeys.TARGET_POSITION)).toBe(false);
      });

      it('SetBlackboardValue should set value', () => {
        const setValue = new SetBlackboardValue('testKey', 'testValue');
        const entity = createTestNPC(world);
        const blackboard = new Blackboard(entity);

        const result = setValue.tick({
          entity,
          blackboard,
          physics: mockPhysics as unknown as PhysicsSystem,
          deltaTime: 16,
        });

        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get('testKey')).toBe('testValue');
      });
    });
  });

  describe('AISystem', () => {
    it('should register behavior trees', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const factory = jest.fn().mockReturnValue(new BehaviorTree(new SuccessAction(), createTestNPC(world)));
      aiSystem.registerBehavior('test', factory);

      expect(aiSystem.getBehavior('test')).toBe(factory);
    });

    it('should assign behavior to entity', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const entity = createTestNPC(world);
      entity.addComponent(createAI('test'));

      const factory = jest.fn().mockReturnValue(new BehaviorTree(new SuccessAction(), entity));
      aiSystem.registerBehavior('test', factory);

      const result = aiSystem.assignBehavior(entity, 'test');
      expect(result).toBe(true);
      expect(factory).toHaveBeenCalledWith(entity);
    });

    it('should fail to assign unregistered behavior', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const entity = createTestNPC(world);
      entity.addComponent(createAI('unknown'));

      const result = aiSystem.assignBehavior(entity, 'unknown');
      expect(result).toBe(false);
    });

    it('should get memory system for entity', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const entity = createTestNPC(world);
      const memorySystem = aiSystem.getMemorySystem(entity);

      expect(memorySystem).toBeInstanceOf(MemorySystem);
    });

    it('should process memory decay', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const entity = createTestNPC(world);
      const memorySystem = aiSystem.getMemorySystem(entity);
      expect(memorySystem).toBeDefined();
      memorySystem!.setTurn(0);
      memorySystem!.rememberEntity(1, RelationshipType.HOSTILE);

      aiSystem.setGlobalTurn(1000);
      aiSystem.processMemoryDecay();

      // Memory should be decayed
    });

    it('should emit events on entity added/removed', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const addedHandler = jest.fn();
      const removedHandler = jest.fn();

      eventBus.on('ai:entityAdded', addedHandler);
      eventBus.on('ai:entityRemoved', removedHandler);

      const entity = createTestNPC(world);
      entity.addComponent(createAI('test'));

      aiSystem.onEntityAdded(entity);
      expect(addedHandler).toHaveBeenCalledWith({ entityId: entity.id });

      aiSystem.onEntityRemoved(entity);
      expect(removedHandler).toHaveBeenCalledWith({ entityId: entity.id });
    });

    it('should remember entity for observer', () => {
      const gameWorld = new World(100, 100, 64, world);
      const pathfinding = new Pathfinding(gameWorld);
      const aiSystem = new AISystem(world, mockPhysics as unknown as PhysicsSystem, pathfinding, eventBus);

      const observer = createTestNPC(world);
      const target = createTestNPC(world, { x: 10, y: 10 });
      target.addComponent(createHealth(50, 100));

      aiSystem.rememberEntity(observer, target.id, RelationshipType.HOSTILE, {
        position: { x: 10, y: 10 },
        health: 50,
      });

      const memorySystem = aiSystem.getMemorySystem(observer);
      expect(memorySystem).toBeDefined();
      expect(memorySystem!.hasMemoryOfEntity(target.id)).toBe(true);
    });
  });
});
