/**
 * Look Mode Tests
 * Tests for the look mode controller
 */

import { LookMode } from '../../src/interaction/LookMode';
import { ECSWorld, Entity } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/world';
import { FOVSystem } from '../../src/physics';
import { ItemManager } from '../../src/items';
import { PhysicsSystem } from '../../src/physics';
import { Direction } from '../../src/core/Types';

describe('LookMode', () => {
  let lookMode: LookMode;
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;
  let world: World;
  let fovSystem: FOVSystem;
  let itemManager: ItemManager;
  let physicsSystem: PhysicsSystem;
  let playerEntity: Entity;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    world = new World(100, 100, 64, ecsWorld);
    fovSystem = new FOVSystem(world);
    itemManager = new ItemManager(eventBus);
    physicsSystem = new PhysicsSystem(world, ecsWorld, eventBus);

    // Create player entity at position (10, 10)
    playerEntity = ecsWorld.createEntity();
    playerEntity.addComponent({
      type: 'position',
      x: 10,
      y: 10,
      z: 0
    } as any);
    playerEntity.addComponent({
      type: 'actor',
      isPlayer: true
    } as any);

    lookMode = new LookMode(
      world,
      fovSystem,
      itemManager,
      physicsSystem,
      ecsWorld,
      eventBus
    );
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('initialization', () => {
    it('should be disabled by default', () => {
      expect(lookMode.isEnabled()).toBe(false);
    });

    it('should have default sidebar width', () => {
      expect(lookMode.getSidebarWidth()).toBe(20);
    });
  });

  describe('enter', () => {
    it('should enter look mode successfully', () => {
      const result = lookMode.enter(playerEntity);
      expect(result).toBe(true);
      expect(lookMode.isEnabled()).toBe(true);
    });

    it('should set cursor to player position', () => {
      lookMode.enter(playerEntity);
      const cursorPos = lookMode.getCursorPosition();
      expect(cursorPos.x).toBe(10);
      expect(cursorPos.y).toBe(10);
      expect(cursorPos.z).toBe(0);
    });

    it('should emit enter event', () => {
      const handler = jest.fn();
      eventBus.on('look:modeEntered', handler);
      
      lookMode.enter(playerEntity);
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        position: { x: 10, y: 10, z: 0 }
      }));
    });

    it('should return false if already in look mode', () => {
      lookMode.enter(playerEntity);
      const result = lookMode.enter(playerEntity);
      expect(result).toBe(false);
    });

    it('should return false if player has no position', () => {
      const entityWithoutPos = ecsWorld.createEntity();
      const result = lookMode.enter(entityWithoutPos);
      expect(result).toBe(false);
    });
  });

  describe('exit', () => {
    it('should exit look mode', () => {
      lookMode.enter(playerEntity);
      lookMode.exit();
      expect(lookMode.isEnabled()).toBe(false);
    });

    it('should emit exit event', () => {
      const handler = jest.fn();
      eventBus.on('look:modeExited', handler);
      
      lookMode.enter(playerEntity);
      lookMode.exit();
      
      expect(handler).toHaveBeenCalled();
    });

    it('should clear available actions on exit', () => {
      lookMode.enter(playerEntity);
      expect(lookMode.getAvailableActions().length).toBeGreaterThan(0);
      
      lookMode.exit();
      expect(lookMode.getAvailableActions().length).toBe(0);
    });
  });

  describe('cursor movement', () => {
    beforeEach(() => {
      // Setup FOV so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
    });

    it('should move cursor north', () => {
      lookMode.moveCursor('north');
      const pos = lookMode.getCursorPosition();
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(9);
    });

    it('should move cursor south', () => {
      lookMode.moveCursor('south');
      const pos = lookMode.getCursorPosition();
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(11);
    });

    it('should move cursor east', () => {
      lookMode.moveCursor('east');
      const pos = lookMode.getCursorPosition();
      expect(pos.x).toBe(11);
      expect(pos.y).toBe(10);
    });

    it('should move cursor west', () => {
      lookMode.moveCursor('west');
      const pos = lookMode.getCursorPosition();
      expect(pos.x).toBe(9);
      expect(pos.y).toBe(10);
    });

    it('should emit cursor moved event', () => {
      const handler = jest.fn();
      eventBus.on('look:cursorMoved', handler);
      
      lookMode.moveCursor('north');
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        position: { x: 10, y: 9, z: 0 }
      }));
    });

    it('should update available actions on move', () => {
      // Create an item at (11, 10)
      itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 11, y: 10 });
      
      // Move to adjacent tile
      lookMode.moveCursor('east');
      
      const actions = lookMode.getAvailableActions();
      expect(actions.some(a => a.id === 'grab')).toBe(true);
    });

    it('should not move to invisible/unexplored tiles', () => {
      // Reset FOV to make tiles invisible
      fovSystem.reset();
      
      const result = lookMode.moveCursor('north');
      expect(result).toBe(false);
      
      const pos = lookMode.getCursorPosition();
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(10);
    });

    it('should return false when not in look mode', () => {
      lookMode.exit();
      const result = lookMode.moveCursor('north');
      expect(result).toBe(false);
    });
  });

  describe('visibility status', () => {
    beforeEach(() => {
      lookMode.enter(playerEntity);
    });

    it('should report visible for visible tiles', () => {
      fovSystem.computeFOV(10, 10, 10);
      expect(lookMode.getVisibilityStatus()).toBe('visible');
    });

    it('should report explored for explored but not visible tiles', () => {
      // First make it visible
      fovSystem.computeFOV(10, 10, 10);
      // Then reset FOV but keep explored
      fovSystem.reset();
      
      expect(lookMode.getVisibilityStatus()).toBe('explored');
    });

    it('should report unknown for unexplored tiles', () => {
      fovSystem.reset();
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      
      expect(lookMode.getVisibilityStatus()).toBe('unknown');
    });
  });

  describe('canLookAt', () => {
    it('should return true for visible tiles', () => {
      fovSystem.computeFOV(10, 10, 10);
      expect(lookMode.canLookAt(10, 10)).toBe(true);
      expect(lookMode.canLookAt(11, 10)).toBe(true);
    });

    it('should return true for explored tiles', () => {
      fovSystem.computeFOV(10, 10, 10);
      fovSystem.reset();
      expect(lookMode.canLookAt(10, 10)).toBe(true);
    });

    it('should return false for unknown tiles', () => {
      fovSystem.reset();
      expect(lookMode.canLookAt(50, 50)).toBe(false);
    });
  });

  describe('tile info', () => {
    beforeEach(() => {
      lookMode.enter(playerEntity);
    });

    it('should return tile info at cursor', () => {
      const tileInfo = lookMode.getTileInfo();
      expect(tileInfo).not.toBeNull();
      expect(tileInfo?.char).toBeDefined();
      expect(tileInfo?.fg).toBeDefined();
      expect(tileInfo?.bg).toBeDefined();
    });

    it('should include terrain properties', () => {
      const tileInfo = lookMode.getTileInfo();
      expect(tileInfo?.blocksMovement).toBeDefined();
      expect(tileInfo?.blocksLight).toBeDefined();
      expect(tileInfo?.transparent).toBeDefined();
    });
  });

  describe('entities at cursor', () => {
    beforeEach(() => {
      lookMode.enter(playerEntity);
    });

    it('should return empty array when no entities present', () => {
      const entities = lookMode.getEntitiesAtCursor();
      expect(entities).toEqual([]);
    });

    it('should return entities at cursor position', () => {
      // Create NPC at player position
      const npc = ecsWorld.createEntity();
      npc.addComponent({
        type: 'position',
        x: 10,
        y: 10,
        z: 0
      } as any);
      
      const entities = lookMode.getEntitiesAtCursor();
      expect(entities.length).toBe(1);
      expect(entities[0].id).toBe(npc.id);
    });

    it('should not return entities at different positions', () => {
      // Create NPC at different position
      const npc = ecsWorld.createEntity();
      npc.addComponent({
        type: 'position',
        x: 20,
        y: 20,
        z: 0
      } as any);
      
      const entities = lookMode.getEntitiesAtCursor();
      expect(entities.length).toBe(0);
    });
  });

  describe('items at cursor', () => {
    beforeEach(() => {
      lookMode.enter(playerEntity);
    });

    it('should return empty array when no items present', () => {
      const items = lookMode.getItemsAtCursor();
      expect(items).toEqual([]);
    });

    it('should return items at cursor position', () => {
      const item = itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 10, y: 10 });
      
      const items = lookMode.getItemsAtCursor();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(item?.id);
    });
  });

  describe('available actions', () => {
    beforeEach(() => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
    });

    it('should return actions after entering look mode', () => {
      const actions = lookMode.getAvailableActions();
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should include Look action', () => {
      const actions = lookMode.getAvailableActions();
      expect(actions.some(a => a.id === 'look')).toBe(true);
    });

    it('should include Examine action', () => {
      const actions = lookMode.getAvailableActions();
      expect(actions.some(a => a.id === 'examine')).toBe(true);
    });
  });

  describe('execute action by hotkey', () => {
    beforeEach(() => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
    });

    it('should execute action and emit event', async () => {
      const handler = jest.fn();
      eventBus.on('look:actionExecuted', handler);
      
      await lookMode.executeActionByHotkey('l'); // Look action
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        actionId: 'look',
        hotkey: 'l'
      }));
    });

    it('should return false for invalid hotkey', async () => {
      const result = await lookMode.executeActionByHotkey('z');
      expect(result).toBe(false);
    });

    it('should return false when not in look mode', async () => {
      lookMode.exit();
      const result = await lookMode.executeActionByHotkey('l');
      expect(result).toBe(false);
    });
  });

  describe('execute action by number', () => {
    beforeEach(() => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
    });

    it('should execute action and emit event', async () => {
      const handler = jest.fn();
      eventBus.on('look:actionExecuted', handler);
      
      await lookMode.executeActionByNumber(1); // Look action
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        actionId: 'look',
        number: 1
      }));
    });

    it('should return false for invalid number', async () => {
      const result = await lookMode.executeActionByNumber(99);
      expect(result).toBe(false);
    });
  });

  describe('action description', () => {
    beforeEach(() => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
    });

    it('should return description for action', () => {
      const actions = lookMode.getAvailableActions();
      const lookAction = actions.find(a => a.id === 'look')!;
      
      const description = lookMode.getActionDescription(lookAction);
      expect(description).toBeDefined();
    });
  });
});
