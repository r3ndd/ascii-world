/**
 * Contextual Action Tests
 * Tests for the contextual action system
 */

import {
  LookAction,
  ExamineAction,
  GrabAction,
  OpenAction,
  CloseAction,
  UseAction,
  MoveToAction,
  ActionContext,
  getAvailableActions,
  CONTEXTUAL_ACTIONS
} from '../../src/interaction/ContextualAction';
import { ECSWorld, Entity } from '../../src/ecs';
import { EventBus } from '../../src/core/EventBus';


describe('ContextualAction', () => {
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;
  let playerEntity: Entity;
  let mockContext: ActionContext;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    
    // Create player entity
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

    // Setup mock context
    mockContext = {
      targetPosition: { x: 10, y: 10, z: 0 },
      playerEntity,
      ecsWorld,
      world: {
        getTileAt: jest.fn().mockReturnValue({
          terrain: 'floor',
          char: '.',
          fg: '#888888',
          bg: '#000000',
          blocksMovement: false,
          blocksLight: false,
          transparent: true
        })
      },
      itemManager: {
        getItemsAt: jest.fn().mockReturnValue([])
      },
      fovSystem: {
        isVisible: jest.fn().mockReturnValue(true),
        isExplored: jest.fn().mockReturnValue(true)
      },
      physicsSystem: {
        moveEntity: jest.fn().mockReturnValue(true)
      }
    };
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  afterAll(() => {
    ecsWorld.clear();
  });

  describe('LookAction', () => {
    it('should have correct properties', () => {
      const action = new LookAction();
      expect(action.id).toBe('look');
      expect(action.label).toBe('Look');
      expect(action.hotkey).toBe('l');
      expect(action.number).toBe(1);
      expect(action.cost).toBe(0);
    });

    it('should always be available', () => {
      const action = new LookAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should return false (not end look mode)', () => {
      const action = new LookAction();
      expect(action.execute(mockContext)).toBe(false);
    });
  });

  describe('ExamineAction', () => {
    it('should have correct properties', () => {
      const action = new ExamineAction();
      expect(action.id).toBe('examine');
      expect(action.label).toBe('Examine');
      expect(action.hotkey).toBe('e');
      expect(action.number).toBe(2);
      expect(action.cost).toBe(0);
    });

    it('should be available for visible tiles', () => {
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(true);
      const action = new ExamineAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should be available for explored tiles', () => {
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(false);
      mockContext.fovSystem.isExplored = jest.fn().mockReturnValue(true);
      const action = new ExamineAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should not be available for unknown tiles', () => {
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(false);
      mockContext.fovSystem.isExplored = jest.fn().mockReturnValue(false);
      const action = new ExamineAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should return false (not end look mode)', () => {
      const action = new ExamineAction();
      expect(action.execute(mockContext)).toBe(false);
    });
  });

  describe('GrabAction', () => {
    it('should have correct properties', () => {
      const action = new GrabAction();
      expect(action.id).toBe('grab');
      expect(action.label).toBe('Grab');
      expect(action.hotkey).toBe('g');
      expect(action.number).toBe(3);
      expect(action.cost).toBe(50);
    });

    it('should be available when adjacent to items', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 }; // Adjacent
      mockContext.itemManager.getItemsAt = jest.fn().mockReturnValue([
        { id: 1 } as Entity
      ]);
      const action = new GrabAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should not be available when not adjacent', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 }; // Not adjacent
      mockContext.itemManager.getItemsAt = jest.fn().mockReturnValue([
        { id: 1 } as Entity
      ]);
      const action = new GrabAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should not be available when no items present', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 }; // Adjacent
      mockContext.itemManager.getItemsAt = jest.fn().mockReturnValue([]);
      const action = new GrabAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should return description with item name', () => {
      const mockItem = {
        getComponent: jest.fn().mockReturnValue({ name: 'Iron Sword' })
      } as unknown as Entity;
      mockContext.targetPosition = { x: 11, y: 10, z: 0 };
      mockContext.itemManager.getItemsAt = jest.fn().mockReturnValue([mockItem]);
      
      const action = new GrabAction();
      expect(action.getDescription?.(mockContext)).toBe('Iron Sword');
    });

    it('should return description with item count', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 };
      mockContext.itemManager.getItemsAt = jest.fn().mockReturnValue([
        { id: 1 } as Entity,
        { id: 2 } as Entity,
        { id: 3 } as Entity
      ]);
      
      const action = new GrabAction();
      expect(action.getDescription?.(mockContext)).toBe('3 items');
    });

    it('should return true (end look mode)', () => {
      const action = new GrabAction();
      expect(action.execute(mockContext)).toBe(true);
    });
  });

  describe('OpenAction', () => {
    it('should have correct properties', () => {
      const action = new OpenAction();
      expect(action.id).toBe('open');
      expect(action.label).toBe('Open');
      expect(action.hotkey).toBe('o');
      expect(action.number).toBe(4);
      expect(action.cost).toBe(100);
    });

    it('should be available when adjacent to door', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 };
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'door',
        blocksMovement: true,
        blocksLight: true
      });
      const action = new OpenAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should not be available when not adjacent', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 };
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'door',
        blocksMovement: true,
        blocksLight: true
      });
      const action = new OpenAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should return true (end look mode)', () => {
      const action = new OpenAction();
      expect(action.execute(mockContext)).toBe(true);
    });
  });

  describe('CloseAction', () => {
    it('should have correct properties', () => {
      const action = new CloseAction();
      expect(action.id).toBe('close');
      expect(action.label).toBe('Close');
      expect(action.hotkey).toBe('c');
      expect(action.number).toBe(5);
      expect(action.cost).toBe(100);
    });

    it('should return true (end look mode)', () => {
      const action = new CloseAction();
      expect(action.execute(mockContext)).toBe(true);
    });
  });

  describe('UseAction', () => {
    it('should have correct properties', () => {
      const action = new UseAction();
      expect(action.id).toBe('use');
      expect(action.label).toBe('Use');
      expect(action.hotkey).toBe('u');
      expect(action.number).toBe(6);
      expect(action.cost).toBe(100);
    });

    it('should be available when adjacent to stairs', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 };
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'stairs_up',
        blocksMovement: false,
        blocksLight: false
      });
      const action = new UseAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should be available when adjacent to stairs_down', () => {
      mockContext.targetPosition = { x: 11, y: 10, z: 0 };
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'stairs_down',
        blocksMovement: false,
        blocksLight: false
      });
      const action = new UseAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should not be available when not adjacent', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 };
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'stairs_up',
        blocksMovement: false,
        blocksLight: false
      });
      const action = new UseAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should return true (end look mode)', () => {
      const action = new UseAction();
      expect(action.execute(mockContext)).toBe(true);
    });
  });

  describe('MoveToAction', () => {
    it('should have correct properties', () => {
      const action = new MoveToAction();
      expect(action.id).toBe('move_to');
      expect(action.label).toBe('Move to');
      expect(action.hotkey).toBe('m');
      expect(action.number).toBe(7);
      expect(action.cost).toBe(0);
    });

    it('should be available for visible passable tiles', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 };
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(true);
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'floor',
        blocksMovement: false
      });
      const action = new MoveToAction();
      expect(action.isAvailable(mockContext)).toBe(true);
    });

    it('should not be available for impassable tiles', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 };
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(true);
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'wall',
        blocksMovement: true
      });
      const action = new MoveToAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should not be available for invisible tiles', () => {
      mockContext.targetPosition = { x: 20, y: 10, z: 0 };
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(false);
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'floor',
        blocksMovement: false
      });
      const action = new MoveToAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should not be available at player position', () => {
      mockContext.targetPosition = { x: 10, y: 10, z: 0 }; // Same as player
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(true);
      mockContext.world.getTileAt = jest.fn().mockReturnValue({
        terrain: 'floor',
        blocksMovement: false
      });
      const action = new MoveToAction();
      expect(action.isAvailable(mockContext)).toBe(false);
    });

    it('should return true (end look mode)', () => {
      const action = new MoveToAction();
      expect(action.execute(mockContext)).toBe(true);
    });
  });

  describe('getAvailableActions', () => {
    it('should return all available actions', () => {
      const actions = getAvailableActions(mockContext);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.id === 'look')).toBe(true);
      expect(actions.some(a => a.id === 'examine')).toBe(true);
    });

    it('should filter out unavailable actions', () => {
      // Make target not visible or explored
      mockContext.fovSystem.isVisible = jest.fn().mockReturnValue(false);
      mockContext.fovSystem.isExplored = jest.fn().mockReturnValue(false);
      
      const actions = getAvailableActions(mockContext);
      expect(actions.some(a => a.id === 'examine')).toBe(false);
    });
  });

  describe('CONTEXTUAL_ACTIONS registry', () => {
    it('should contain all action types', () => {
      expect(CONTEXTUAL_ACTIONS.length).toBe(7);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'look')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'examine')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'grab')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'open')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'close')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'use')).toBe(true);
      expect(CONTEXTUAL_ACTIONS.some(a => a.id === 'move_to')).toBe(true);
    });
  });
});
