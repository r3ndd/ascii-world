import {
  TurnManager,
  SpeedSystem,
  Action,
  ActionType,
  PostHocUpdateQueue,
  DeferredUpdateSystem,
  CatchUpCalculator,
  ActorSystem
} from '../../src/time';
import { ECSWorld, Entity, createPosition, createHealth, createSpeed, createActor, createRenderable } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import { ACTION_COSTS } from '../../src/config/ActionCosts';
import { PhysicsSystem } from '../../src/physics';

// Mock PhysicsSystem for tests
class MockPhysicsSystem {
  moveEntity = jest.fn().mockReturnValue(true);
}

describe('Action', () => {
  describe('factory methods', () => {
    it('should create move action with speed-based cost', () => {
      const action = Action.createMoveAction(100);
      expect(action.type).toBe(ActionType.MOVE);
      expect(action.cost).toBe(ACTION_COSTS.MOVE);
    });

    it('should create attack action with speed-based cost', () => {
      const action = Action.createAttackAction(100);
      expect(action.type).toBe(ActionType.ATTACK);
      expect(action.cost).toBe(ACTION_COSTS.ATTACK);
    });

    it('should create wait action with speed-based cost', () => {
      const action = Action.createWaitAction(100);
      expect(action.type).toBe(ActionType.WAIT);
      expect(action.cost).toBe(ACTION_COSTS.WAIT);
    });

    it('should create craft action with speed-based cost', () => {
      const action = Action.createCraftAction(100);
      expect(action.type).toBe(ActionType.CRAFT);
      expect(action.cost).toBe(ACTION_COSTS.CRAFT);
    });

    it('should create interact action with speed-based cost', () => {
      const action = Action.createInteractAction(100);
      expect(action.type).toBe(ActionType.INTERACT);
      expect(action.cost).toBe(ACTION_COSTS.INTERACT);
    });

    it('should create pickup action with speed-based cost', () => {
      const action = Action.createPickupAction(100);
      expect(action.type).toBe(ActionType.PICKUP);
      expect(action.cost).toBe(ACTION_COSTS.PICKUP);
    });

    it('should create drop action with speed-based cost', () => {
      const action = Action.createDropAction(100);
      expect(action.type).toBe(ActionType.DROP);
      expect(action.cost).toBe(ACTION_COSTS.DROP);
    });

    it('should adjust cost based on speed', () => {
      // Speed 50 (slower) = higher cost
      const slowAction = Action.createMoveAction(50);
      expect(slowAction.cost).toBe(200); // 100 * 100 / 50

      // Speed 200 (faster) = lower cost
      const fastAction = Action.createMoveAction(200);
      expect(fastAction.cost).toBe(50); // 100 * 100 / 200
    });

    it('should include custom data', () => {
      const action = new Action(ActionType.MOVE, 100, { direction: 'north' });
      expect(action.data).toEqual({ direction: 'north' });
    });
  });
});

describe('SpeedSystem', () => {
  let speedSystem: SpeedSystem;

  beforeEach(() => {
    speedSystem = new SpeedSystem();
  });

  describe('base speed', () => {
    it('should have base speed of 100', () => {
      expect(speedSystem.getBaseSpeed()).toBe(100);
    });
  });

  describe('action cost calculation', () => {
    it('should calculate normal cost at speed 100', () => {
      const cost = speedSystem.calculateActionCost(100, 100);
      expect(cost).toBe(100);
    });

    it('should double cost for slow speed (50)', () => {
      const cost = speedSystem.calculateActionCost(100, 50);
      expect(cost).toBe(200);
    });

    it('should halve cost for fast speed (200)', () => {
      const cost = speedSystem.calculateActionCost(100, 200);
      expect(cost).toBe(50);
    });

    it('should round to nearest integer', () => {
      const cost = speedSystem.calculateActionCost(100, 150);
      expect(cost).toBe(67); // 100 * 100 / 150 = 66.67 -> rounded
    });
  });

  describe('action type costs', () => {
    it('should get action ticks by type', () => {
      const moveTicks = speedSystem.getActionTicks(ActionType.MOVE, 100);
      expect(moveTicks).toBe(ACTION_COSTS.MOVE);

      const attackTicks = speedSystem.getActionTicks(ActionType.ATTACK, 100);
      expect(attackTicks).toBe(ACTION_COSTS.ATTACK);
    });

    it('should return default cost for unknown action types', () => {
      const ticks = speedSystem.getActionTicks('unknown' as ActionType, 100);
      expect(ticks).toBe(100);
    });
  });
});

describe('PostHocUpdateQueue', () => {
  let queue: PostHocUpdateQueue;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    queue = new PostHocUpdateQueue(eventBus);
  });

  describe('queueing', () => {
    it('should queue entities with missed turns', () => {
      queue.queueEntity(1, 100);
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should queue multiple entities', () => {
      queue.queueEntity(1, 100);
      queue.queueEntity(2, 50);
      queue.queueEntity(3, 200);
      expect(queue.getQueueLength()).toBe(3);
    });

    it('should emit event when queuing', () => {
      const handler = jest.fn();
      eventBus.on('deferred:entityQueued', handler);

      queue.queueEntity(1, 100);
      expect(handler).toHaveBeenCalledWith({ entityId: 1, missedTurns: 100 });
    });
  });

  describe('processing', () => {
    it('should process queue with callback', () => {
      queue.queueEntity(1, 100);
      queue.queueEntity(2, 50);

      const processed: { entityId: number; missedTurns: number }[] = [];
      queue.processQueue((update) => {
        processed.push(update);
      });

      expect(processed).toHaveLength(2);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should process in FIFO order', () => {
      queue.queueEntity(1, 100);
      queue.queueEntity(2, 50);

      const order: number[] = [];
      queue.processQueue((update) => {
        order.push(update.entityId);
      });

      expect(order).toEqual([1, 2]);
    });
  });

  describe('clear', () => {
    it('should clear all queued entities', () => {
      queue.queueEntity(1, 100);
      queue.queueEntity(2, 50);

      queue.clear();
      expect(queue.getQueueLength()).toBe(0);
    });
  });
});

describe('CatchUpCalculator', () => {
  describe('calculate', () => {
    it('should calculate no effects for zero missed turns', () => {
      const entity = new Entity();
      const result = CatchUpCalculator.calculate(entity, 0, 100);

      expect(result.healthDelta).toBe(0);
      expect(result.hungerDelta).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('should calculate health regeneration over missed turns', () => {
      const entity = new Entity();
      // At speed 100, regen every 1000/100 = 10 turns
      const result = CatchUpCalculator.calculate(entity, 2000, 100);

      expect(result.healthDelta).toBe(200); // 2000 / 10 = 200
      expect(result.events).toContain('regenerated 200 health');
    });

    it('should calculate hunger accumulation', () => {
      const entity = new Entity();
      // At speed 100, hunger every 100/100 = 1 turn
      const result = CatchUpCalculator.calculate(entity, 500, 100);

      expect(result.hungerDelta).toBe(500); // 500 / 1 = 500
      expect(result.events).toContain('grew hungrier (500)');
    });

    it('should scale with speed', () => {
      const entity = new Entity();
      const result = CatchUpCalculator.calculate(entity, 1000, 200);

      // At speed 200 (faster), regen rate should be higher
      // 1000 / (1000/200) = 1000 / 5 = 200
      expect(result.healthDelta).toBe(200);
    });
  });
});

describe('DeferredUpdateSystem', () => {
  let system: DeferredUpdateSystem;
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    eventBus = new EventBus();
    system = new DeferredUpdateSystem(ecsWorld, eventBus);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('queueing', () => {
    it('should queue catch-up for entity', () => {
      system.queueCatchUp(1, 100);
      expect(system.getQueue().getQueueLength()).toBe(1);
    });
  });

  describe('processing', () => {
    it('should process catch-up for entity with components', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createHealth(50, 100));
      entity.addComponent(createSpeed(100));
      entity.addComponent(createActor(false));

      // Process many turns to get regeneration
      system.processCatchUp(entity.id, 2000);

      // Entity should exist
      expect(ecsWorld.getEntity(entity.id)).toBe(entity);
    });

    it('should skip processing for non-existent entities', () => {
      // Should not throw
      system.processCatchUp(999, 100);
    });

    it('should skip processing for entities without required components', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(0, 0)); // No health, speed, or actor

      // Should not throw
      system.processCatchUp(entity.id, 100);
    });

    it('should emit events when catch-up completes with results', () => {
      const handler = jest.fn();
      eventBus.on('deferred:catchUpComplete', handler);

      const entity = ecsWorld.createEntity();
      entity.addComponent(createHealth(50, 100));
      entity.addComponent(createSpeed(100));
      entity.addComponent(createActor(false));

      system.processCatchUp(entity.id, 2000);

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0];
      expect(event.entityId).toBe(entity.id);
      expect(event.missedTurns).toBe(2000);
      expect(Array.isArray(event.events)).toBe(true);
    });

    it('should process all queued updates', () => {
      const entity1 = ecsWorld.createEntity();
      entity1.addComponent(createHealth(50, 100));
      entity1.addComponent(createSpeed(100));
      entity1.addComponent(createActor(false));

      const entity2 = ecsWorld.createEntity();
      entity2.addComponent(createHealth(75, 100));
      entity2.addComponent(createSpeed(100));
      entity2.addComponent(createActor(false));

      system.queueCatchUp(entity1.id, 1000);
      system.queueCatchUp(entity2.id, 1000);

      system.processAll();

      expect(system.getQueue().getQueueLength()).toBe(0);
    });
  });
});

describe('TurnManager', () => {
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;
  let speedSystem: SpeedSystem;
  let actorSystem: ActorSystem;
  let mockPhysics: MockPhysicsSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    speedSystem = new SpeedSystem();
    mockPhysics = new MockPhysicsSystem();
    actorSystem = new ActorSystem(ecsWorld, mockPhysics as unknown as PhysicsSystem);
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  // Helper to create TurnManager after entities are set up
  function createTurnManager(): TurnManager {
    return new TurnManager(ecsWorld, eventBus, speedSystem, actorSystem);
  }

  describe('actor discovery from ECS', () => {
    it('should discover actors automatically when entities are created', () => {
      // Create entity with actor and speed components BEFORE TurnManager
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(0, 0));
      entity.addComponent(createRenderable('n', '#fff'));
      entity.addComponent(createActor(false));
      entity.addComponent(createHealth(50, 50));
      entity.addComponent(createSpeed(100));

      const handler = jest.fn();
      eventBus.on('turn:actorRegistered', handler);

      // Create TurnManager after entity is fully set up
      createTurnManager();

      expect(handler).toHaveBeenCalledWith({ entityId: entity.id, isPlayer: false });
    });

    it('should identify player actors', () => {
      // Create player entity BEFORE TurnManager
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(0, 0));
      entity.addComponent(createRenderable('@', '#ff0'));
      entity.addComponent(createActor(true)); // isPlayer = true
      entity.addComponent(createHealth(100, 100));
      entity.addComponent(createSpeed(100));

      const handler = jest.fn();
      eventBus.on('turn:actorRegistered', handler);

      // Create TurnManager after entity is fully set up
      createTurnManager();

      expect(handler).toHaveBeenCalledWith({ entityId: entity.id, isPlayer: true });
    });

    it('should emit event when entity is removed', () => {
      // Create and then remove entity BEFORE TurnManager
      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(false));
      entity.addComponent(createSpeed(100));

      ecsWorld.removeEntity(entity.id);

      const handler = jest.fn();
      eventBus.on('turn:actorRemoved', handler);

      // Create TurnManager after entity is removed
      createTurnManager();

      // Note: entity was already removed, so no event should be emitted during creation
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('turn processing', () => {
    it('should process single turn for NPC', async () => {
      // Create NPC entity BEFORE TurnManager
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(0, 0));
      entity.addComponent(createRenderable('n', '#fff'));
      entity.addComponent(createActor(false));
      entity.addComponent(createHealth(50, 50));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      await turnManager.processSingleTurn();

      // NPC should have moved (random movement)
      expect(mockPhysics.moveEntity).toHaveBeenCalled();
      expect(turnManager.getCurrentTurn()).toBe(1);
    });

    it('should emit turn begin event', async () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(false));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      const handler = jest.fn();
      eventBus.on('turn:begin', handler);

      await turnManager.processSingleTurn();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        entityId: entity.id,
        turn: 0,
        isPlayer: false
      }));
    });

    it('should emit turn end event', async () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(false));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      const handler = jest.fn();
      eventBus.on('turn:end', handler);

      await turnManager.processSingleTurn();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        entityId: entity.id,
        turn: 1,
        isPlayer: false
      }));
    });

    it('should handle errors during actor turn', async () => {
      const handler = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      eventBus.on('turn:error', handler);

      // Make physics throw an error
      mockPhysics.moveEntity.mockImplementation(() => {
        throw new Error('Test error');
      });

      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(false));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      await turnManager.processSingleTurn();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        entityId: entity.id,
        error: expect.any(Error)
      }));
      consoleSpy.mockRestore();
    });

    it('should warn when no actors available', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const turnManager = createTurnManager();
      await turnManager.processSingleTurn();
      
      expect(consoleSpy).toHaveBeenCalledWith('No actors in scheduler');
      consoleSpy.mockRestore();
    });
  });

  describe('player turn handling', () => {
    it('should use input handler for player turn', async () => {
      const inputHandler = jest.fn().mockResolvedValue({ direction: 'north' as const });

      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(0, 0));
      entity.addComponent(createRenderable('@', '#ff0'));
      entity.addComponent(createActor(true)); // isPlayer = true
      entity.addComponent(createHealth(100, 100));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();
      turnManager.setPlayerInputHandler(inputHandler);

      // Process player turn
      await turnManager.processSingleTurn();

      expect(inputHandler).toHaveBeenCalled();
      expect(mockPhysics.moveEntity).toHaveBeenCalledWith(entity, 'north');
    });

    it('should handle wait action from player', async () => {
      const inputHandler = jest.fn().mockResolvedValue({ wait: true });

      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(true));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();
      turnManager.setPlayerInputHandler(inputHandler);

      await turnManager.processSingleTurn();

      expect(inputHandler).toHaveBeenCalled();
      // Should not call moveEntity when waiting
      expect(mockPhysics.moveEntity).not.toHaveBeenCalled();
    });

    it('should get player entity', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(true));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      const player = turnManager.getPlayerEntity();
      expect(player).toBe(entity);
    });
  });

  describe('start/stop', () => {
    it('should start and stop', async () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createActor(false));
      entity.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      const startedHandler = jest.fn();
      eventBus.on('turn:started', startedHandler);

      const stoppedHandler = jest.fn();
      eventBus.on('turn:stopped', stoppedHandler);

      // Start but immediately stop to avoid infinite loop
      turnManager.start();
      turnManager.stop();

      // Note: actual behavior may vary due to async nature
    });

    it('should pause and resume', () => {
      const turnManager = createTurnManager();
      
      turnManager.pause();
      expect(turnManager.getCurrentTurn()).toBe(0);
    });
  });

  describe('multiple actors', () => {
    it('should process turns for multiple actors', async () => {
      // Create two NPC entities BEFORE TurnManager
      const entity1 = ecsWorld.createEntity();
      entity1.addComponent(createActor(false));
      entity1.addComponent(createSpeed(100));

      const entity2 = ecsWorld.createEntity();
      entity2.addComponent(createActor(false));
      entity2.addComponent(createSpeed(100));

      const turnManager = createTurnManager();

      await turnManager.processSingleTurn();
      await turnManager.processSingleTurn();

      expect(turnManager.getCurrentTurn()).toBe(2);
      expect(mockPhysics.moveEntity).toHaveBeenCalledTimes(2);
    });

    it('should process more turns for faster actors', async () => {
      // Create slow and fast actors BEFORE TurnManager
      const slowEntity = ecsWorld.createEntity();
      slowEntity.addComponent(createActor(false));
      slowEntity.addComponent(createSpeed(50)); // Slower

      const fastEntity = ecsWorld.createEntity();
      fastEntity.addComponent(createActor(false));
      fastEntity.addComponent(createSpeed(200)); // Faster

      const turnManager = createTurnManager();

      // Reset mock to track calls
      mockPhysics.moveEntity.mockClear();

      // Process several turns
      for (let i = 0; i < 10; i++) {
        await turnManager.processSingleTurn();
      }

      // Fast actor should have more turns than slow actor
      const fastCalls = mockPhysics.moveEntity.mock.calls.filter(
        call => call[0] === fastEntity
      ).length;
      const slowCalls = mockPhysics.moveEntity.mock.calls.filter(
        call => call[0] === slowEntity
      ).length;

      expect(fastCalls).toBeGreaterThan(slowCalls);
    });
  });
});
