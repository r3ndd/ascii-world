/**
 * Z-axis (layer) functionality tests
 * Tests for multi-layer world support, stairs, and vertical movement
 */

import {
  World,
  TERRAIN,
  ChunkManager
} from '../../src/world';
import { ECSWorld, createPosition } from '../../src/ecs';
import {
  PhysicsSystem,
  StairsSystem,
  StairLink
} from '../../src/physics';
import { EventBus } from '../../src/core/EventBus';
import { Action, ActionType } from '../../src/time';
import { ACTION_COSTS } from '../../src/config/ActionCosts';

describe('Z-Axis / Multi-Layer World', () => {
  let world: World;
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;

  beforeEach(() => {
    ecsWorld = new ECSWorld();
    eventBus = new EventBus();
    world = new World(100, 100, 16, ecsWorld);
    world.initialize();
  });

  describe('World Layer Management', () => {
    it('should create world with default layer 0', () => {
      expect(world.hasLayer(0)).toBe(true);
      expect(world.getLayers()).toEqual([0]);
    });

    it('should add additional layers', () => {
      world.addLayer(1, 50, 50);
      
      expect(world.hasLayer(1)).toBe(true);
      expect(world.getLayers()).toEqual([0, 1]);
    });

    it('should support multiple layers', () => {
      world.addLayer(1, 50, 50);
      world.addLayer(2, 30, 30);
      
      expect(world.getLayers()).toEqual([0, 1, 2]);
    });

    it('should allow different dimensions per layer', () => {
      world.addLayer(1, 50, 50);
      world.addLayer(2, 30, 40);
      
      expect(world.getWidth(0)).toBe(100);
      expect(world.getHeight(0)).toBe(100);
      expect(world.getWidth(1)).toBe(50);
      expect(world.getHeight(1)).toBe(50);
      expect(world.getWidth(2)).toBe(30);
      expect(world.getHeight(2)).toBe(40);
    });

    it('should remove non-default layers', () => {
      world.addLayer(1, 50, 50);
      
      const result = world.removeLayer(1);
      
      expect(result).toBe(true);
      expect(world.hasLayer(1)).toBe(false);
    });

    it('should not allow removing default layer', () => {
      expect(() => world.removeLayer(0)).toThrow('Cannot remove the default layer');
    });

    it('should get chunk manager for specific layer', () => {
      world.addLayer(1, 50, 50);
      
      const chunkManager0 = world.getChunkManager(0);
      const chunkManager1 = world.getChunkManager(1);
      
      expect(chunkManager0).toBeInstanceOf(ChunkManager);
      expect(chunkManager1).toBeInstanceOf(ChunkManager);
      expect(chunkManager0).not.toBe(chunkManager1);
    });

    it('should throw for non-existent layer', () => {
      expect(() => world.getChunkManager(99)).toThrow('Layer 99 does not exist');
    });
  });

  describe('Layer-Specific Tile Operations', () => {
    beforeEach(() => {
      world.addLayer(1, 50, 50);
    });

    it('should set and get tiles on different layers', () => {
      world.setTileAt(10, 10, TERRAIN.wall, 0);
      world.setTileAt(10, 10, TERRAIN.floor, 1);
      
      expect(world.getTileAt(10, 10, 0)?.terrain).toBe('wall');
      expect(world.getTileAt(10, 10, 1)?.terrain).toBe('floor');
    });

    it('should return null for out-of-bounds on specific layer', () => {
      expect(world.getTileAt(60, 60, 1)).toBeNull(); // Layer 1 is only 50x50
    });

    it('should validate positions per layer', () => {
      world.setTileAt(10, 10, TERRAIN.wall, 0);
      world.setTileAt(10, 10, TERRAIN.floor, 1);
      
      expect(world.isValidPosition(10, 10, 0)).toBe(false); // Wall on layer 0
      expect(world.isValidPosition(10, 10, 1)).toBe(true);  // Floor on layer 1
    });

    it('should handle different bounds per layer', () => {
      expect(world.isValidPosition(60, 60, 0)).toBe(true);  // Layer 0 is 100x100
      expect(world.isValidPosition(60, 60, 1)).toBe(false); // Layer 1 is 50x50
    });
  });

  describe('Stairs Terrain Types', () => {
    it('should have stairs_up terrain', () => {
      expect(TERRAIN.stairs_up).toBeDefined();
      expect(TERRAIN.stairs_up.char).toBe('>');
      expect(TERRAIN.stairs_up.blocksMovement).toBe(false);
    });

    it('should have stairs_down terrain', () => {
      expect(TERRAIN.stairs_down).toBeDefined();
      expect(TERRAIN.stairs_down.char).toBe('<');
      expect(TERRAIN.stairs_down.blocksMovement).toBe(false);
    });
  });

  describe('StairsSystem', () => {
    let stairsSystem: StairsSystem;

    beforeEach(() => {
      stairsSystem = new StairsSystem(world, eventBus);
    });

    it('should register stair links', () => {
      const link: StairLink = {
        fromX: 10,
        fromY: 10,
        fromZ: 0,
        toX: 10,
        toY: 10,
        toZ: 1,
        direction: 'up'
      };
      
      stairsSystem.registerStairLink(link);
      
      expect(stairsSystem.hasStairLink(10, 10, 0)).toBe(true);
    });

    it('should get stair link at position', () => {
      const link: StairLink = {
        fromX: 5,
        fromY: 5,
        fromZ: 0,
        toX: 5,
        toY: 5,
        toZ: 1,
        direction: 'up'
      };
      
      stairsSystem.registerStairLink(link);
      const retrieved = stairsSystem.getStairLink(5, 5, 0);
      
      expect(retrieved).toEqual(link);
    });

    it('should return undefined for non-existent stair link', () => {
      expect(stairsSystem.getStairLink(99, 99, 0)).toBeUndefined();
    });

    it('should get all stair links', () => {
      stairsSystem.registerStairLink({
        fromX: 0, fromY: 0, fromZ: 0,
        toX: 0, toY: 0, toZ: 1,
        direction: 'up'
      });
      stairsSystem.registerStairLink({
        fromX: 0, fromY: 0, fromZ: 1,
        toX: 0, toY: 0, toZ: 0,
        direction: 'down'
      });
      
      const links = stairsSystem.getAllStairLinks();
      
      expect(links).toHaveLength(2);
    });

    it('should remove stair links', () => {
      stairsSystem.registerStairLink({
        fromX: 0, fromY: 0, fromZ: 0,
        toX: 0, toY: 0, toZ: 1,
        direction: 'up'
      });
      
      const result = stairsSystem.removeStairLink(0, 0, 0);
      
      expect(result).toBe(true);
      expect(stairsSystem.hasStairLink(0, 0, 0)).toBe(false);
    });

    it('should return false when removing non-existent link', () => {
      expect(stairsSystem.removeStairLink(99, 99, 0)).toBe(false);
    });

    it('should clear all stair links', () => {
      stairsSystem.registerStairLink({
        fromX: 0, fromY: 0, fromZ: 0,
        toX: 0, toY: 0, toZ: 1,
        direction: 'up'
      });
      
      stairsSystem.clear();
      
      expect(stairsSystem.getAllStairLinks()).toHaveLength(0);
    });

    describe('Ascend/Descend Checks', () => {
      beforeEach(() => {
        stairsSystem.registerStairLink({
          fromX: 10, fromY: 10, fromZ: 0,
          toX: 10, toY: 10, toZ: 1,
          direction: 'up'
        });
        stairsSystem.registerStairLink({
          fromX: 20, fromY: 20, fromZ: 1,
          toX: 20, toY: 20, toZ: 0,
          direction: 'down'
        });
      });

      it('should check if can ascend', () => {
        expect(stairsSystem.canAscend(10, 10, 0)).toBe(true);
        expect(stairsSystem.canAscend(20, 20, 1)).toBe(false); // This is down stairs
        expect(stairsSystem.canAscend(99, 99, 0)).toBe(false);
      });

      it('should check if can descend', () => {
        expect(stairsSystem.canDescend(20, 20, 1)).toBe(true);
        expect(stairsSystem.canDescend(10, 10, 0)).toBe(false); // This is up stairs
        expect(stairsSystem.canDescend(99, 99, 0)).toBe(false);
      });

      it('should get ascend destination', () => {
        const dest = stairsSystem.getAscendDestination(10, 10, 0);
        
        expect(dest).toEqual({ x: 10, y: 10, z: 1 });
      });

      it('should get descend destination', () => {
        const dest = stairsSystem.getDescendDestination(20, 20, 1);
        
        expect(dest).toEqual({ x: 20, y: 20, z: 0 });
      });

      it('should return null for invalid ascend', () => {
        expect(stairsSystem.getAscendDestination(99, 99, 0)).toBeNull();
      });

      it('should return null for invalid descend', () => {
        expect(stairsSystem.getDescendDestination(99, 99, 0)).toBeNull();
      });
    });

    describe('Events', () => {
      it('should emit linkRegistered event', () => {
        const handler = jest.fn();
        eventBus.on('stairs:linkRegistered', handler);
        
        stairsSystem.registerStairLink({
          fromX: 0, fromY: 0, fromZ: 0,
          toX: 0, toY: 0, toZ: 1,
          direction: 'up'
        });
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          from: { x: 0, y: 0, z: 0 },
          to: { x: 0, y: 0, z: 1 },
          direction: 'up'
        }));
      });

      it('should emit linkRemoved event', () => {
        const handler = jest.fn();
        eventBus.on('stairs:linkRemoved', handler);
        
        stairsSystem.registerStairLink({
          fromX: 0, fromY: 0, fromZ: 0,
          toX: 0, toY: 0, toZ: 1,
          direction: 'up'
        });
        stairsSystem.removeStairLink(0, 0, 0);
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          from: { x: 0, y: 0, z: 0 },
          to: { x: 0, y: 0, z: 1 }
        }));
      });
    });
  });

  describe('PhysicsSystem with Z-Axis', () => {
    let physicsSystem: PhysicsSystem;
    let stairsSystem: StairsSystem;

    beforeEach(() => {
      physicsSystem = new PhysicsSystem(world, ecsWorld, eventBus);
      stairsSystem = new StairsSystem(world, eventBus);
      world.addLayer(1, 50, 50);
      
      // Set up floors on both layers
      world.setTileAt(25, 25, TERRAIN.floor, 0);
      world.setTileAt(25, 25, TERRAIN.floor, 1);
    });

    it('should include z in movement events', () => {
      const handler = jest.fn();
      eventBus.on('physics:entityMoved', handler);
      
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(25, 25, 0));
      
      physicsSystem.moveEntity(entity, 'east');
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        from: { x: 25, y: 25, z: 0 },
        to: { x: 26, y: 25, z: 0 }
      }));
    });

    it('should get entity position with z', () => {
      const entity = ecsWorld.createEntity();
      entity.addComponent(createPosition(15, 25, 1));
      
      const pos = physicsSystem.getEntityPosition(entity);
      
      expect(pos).toEqual({ x: 15, y: 25, z: 1 });
    });

    describe('Ascend', () => {
      beforeEach(() => {
        stairsSystem.registerStairLink({
          fromX: 25, fromY: 25, fromZ: 0,
          toX: 25, toY: 25, toZ: 1,
          direction: 'up'
        });
      });

      it('should ascend to upper layer', () => {
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(25, 25, 0));
        
        const result = physicsSystem.ascend(entity, stairsSystem);
        
        expect(result).toBe(true);
        const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
        expect(pos?.z).toBe(1);
      });

      it('should emit entityAscended event', () => {
        const handler = jest.fn();
        eventBus.on('physics:entityAscended', handler);
        
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(25, 25, 0));
        
        physicsSystem.ascend(entity, stairsSystem);
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          entityId: entity.id,
          from: { x: 25, y: 25, z: 0 },
          to: { x: 25, y: 25, z: 1 }
        }));
      });

      it('should fail ascend without stairs', () => {
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(10, 10, 0)); // No stairs here
        
        const result = physicsSystem.ascend(entity, stairsSystem);
        
        expect(result).toBe(false);
      });

      it('should emit ascendBlocked event on failure', () => {
        const handler = jest.fn();
        eventBus.on('physics:ascendBlocked', handler);
        
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(10, 10, 0));
        
        physicsSystem.ascend(entity, stairsSystem);
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          entityId: entity.id,
          position: { x: 10, y: 10, z: 0 },
          reason: 'no_stairs_up'
        }));
      });

      it('should fail ascend to invalid destination', () => {
        stairsSystem.registerStairLink({
          fromX: 30, fromY: 30, fromZ: 0,
          toX: 99, toY: 99, toZ: 1, // Out of bounds for layer 1
          direction: 'up'
        });
        world.setTileAt(30, 30, TERRAIN.floor, 0);
        
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(30, 30, 0));
        
        const result = physicsSystem.ascend(entity, stairsSystem);
        
        expect(result).toBe(false);
      });
    });

    describe('Descend', () => {
      beforeEach(() => {
        stairsSystem.registerStairLink({
          fromX: 25, fromY: 25, fromZ: 1,
          toX: 25, toY: 25, toZ: 0,
          direction: 'down'
        });
      });

      it('should descend to lower layer', () => {
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(25, 25, 1));
        
        const result = physicsSystem.descend(entity, stairsSystem);
        
        expect(result).toBe(true);
        const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
        expect(pos?.z).toBe(0);
      });

      it('should emit entityDescended event', () => {
        const handler = jest.fn();
        eventBus.on('physics:entityDescended', handler);
        
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(25, 25, 1));
        
        physicsSystem.descend(entity, stairsSystem);
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          entityId: entity.id,
          from: { x: 25, y: 25, z: 1 },
          to: { x: 25, y: 25, z: 0 }
        }));
      });

      it('should fail descend without stairs', () => {
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(10, 10, 1));
        
        const result = physicsSystem.descend(entity, stairsSystem);
        
        expect(result).toBe(false);
      });

      it('should emit descendBlocked event on failure', () => {
        const handler = jest.fn();
        eventBus.on('physics:descendBlocked', handler);
        
        const entity = ecsWorld.createEntity();
        entity.addComponent(createPosition(10, 10, 1));
        
        physicsSystem.descend(entity, stairsSystem);
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          entityId: entity.id,
          position: { x: 10, y: 10, z: 1 },
          reason: 'no_stairs_down'
        }));
      });
    });
  });

  describe('Ascend/Descend Actions', () => {
    it('should create ascend action with correct type', () => {
      const action = Action.createAscendAction(100);
      
      expect(action.type).toBe(ActionType.ASCEND);
      expect(action.cost).toBe(ACTION_COSTS.ASCEND);
    });

    it('should create descend action with correct type', () => {
      const action = Action.createDescendAction(100);
      
      expect(action.type).toBe(ActionType.DESCEND);
      expect(action.cost).toBe(ACTION_COSTS.DESCEND);
    });

    it('should scale ascend cost with speed', () => {
      const action = Action.createAscendAction(50); // Slow
      
      expect(action.cost).toBe(200); // Double cost
    });

    it('should scale descend cost with speed', () => {
      const action = Action.createDescendAction(200); // Fast
      
      expect(action.cost).toBe(50); // Half cost
    });
  });

  describe('Layer-Specific Entities', () => {
    beforeEach(() => {
      world.addLayer(1, 50, 50);
      world.setTileAt(5, 5, TERRAIN.floor, 0);
      world.setTileAt(5, 5, TERRAIN.floor, 1);
    });

    it('should get entities at specific layer', () => {
      const entity1 = ecsWorld.createEntity();
      entity1.addComponent(createPosition(5, 5, 0));
      
      const entity2 = ecsWorld.createEntity();
      entity2.addComponent(createPosition(5, 5, 1));
      
      // Add entities to chunks manually for this test
      const chunkManager0 = world.getChunkManager(0);
      const chunkManager1 = world.getChunkManager(1);
      const chunk0 = chunkManager0.getOrCreateChunk(0, 0);
      const chunk1 = chunkManager1.getOrCreateChunk(0, 0);
      // Add at local chunk coordinates (5, 5 is within chunk 0,0 with size 16)
      chunk0.addEntity(entity1.id, 5, 5);
      chunk1.addEntity(entity2.id, 5, 5);
      
      const entitiesLayer0 = world.getEntitiesAt(5, 5, 0);
      const entitiesLayer1 = world.getEntitiesAt(5, 5, 1);
      
      expect(entitiesLayer0).toContain(entity1);
      expect(entitiesLayer0).not.toContain(entity2);
      expect(entitiesLayer1).toContain(entity2);
      expect(entitiesLayer1).not.toContain(entity1);
    });
  });
});
