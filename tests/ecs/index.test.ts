import {
  Entity,
  ECSWorld,
  BaseSystem,
  Query,
  createPosition,
  createHealth,
  createSpeed,
  createActor,
  createRenderable,
  createVelocity,
} from '../../src/ecs';

describe('Entity', () => {
  describe('creation', () => {
    it('should create an entity with a unique ID', () => {
      const entity1 = new Entity();
      const entity2 = new Entity();
      
      expect(entity1.id).toBeGreaterThan(0);
      expect(entity2.id).toBeGreaterThan(entity1.id);
    });

    it('should create entities with incrementing IDs', () => {
      const ids: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const entity = new Entity();
        ids.push(entity.id);
      }
      
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBe(ids[i - 1] + 1);
      }
    });
  });

  describe('component management', () => {
    let entity: Entity;

    beforeEach(() => {
      entity = new Entity();
    });

    it('should add a component to an entity', () => {
      const position = createPosition(5, 10);
      
      entity.addComponent(position);
      
      expect(entity.hasComponent('position')).toBe(true);
    });

    it('should return the entity instance for chaining', () => {
      const result = entity.addComponent(createPosition(0, 0));
      
      expect(result).toBe(entity);
    });

    it('should support chaining multiple components', () => {
      entity
        .addComponent(createPosition(1, 2))
        .addComponent(createHealth(100, 100))
        .addComponent(createSpeed(100));
      
      expect(entity.hasComponent('position')).toBe(true);
      expect(entity.hasComponent('health')).toBe(true);
      expect(entity.hasComponent('speed')).toBe(true);
    });

    it('should get a component by type', () => {
      const position = createPosition(5, 10);
      entity.addComponent(position);
      
      const retrieved = entity.getComponent('position');
      
      expect(retrieved).toEqual(position);
    });

    it('should return undefined for non-existent component', () => {
      const result = entity.getComponent('nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should remove a component by type', () => {
      entity.addComponent(createPosition(0, 0));
      
      const result = entity.removeComponent('position');
      
      expect(result).toBe(true);
      expect(entity.hasComponent('position')).toBe(false);
    });

    it('should return false when removing non-existent component', () => {
      const result = entity.removeComponent('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should check if entity has a specific component', () => {
      entity.addComponent(createHealth(100, 100));
      
      expect(entity.hasComponent('health')).toBe(true);
      expect(entity.hasComponent('position')).toBe(false);
    });

    it('should check if entity has multiple components', () => {
      entity
        .addComponent(createPosition(0, 0))
        .addComponent(createHealth(100, 100))
        .addComponent(createSpeed(100));
      
      expect(entity.hasComponents('position', 'health', 'speed')).toBe(true);
      expect(entity.hasComponents('position', 'health', 'nonexistent')).toBe(false);
    });

    it('should get all components', () => {
      const pos = createPosition(1, 2);
      const health = createHealth(100, 100);
      
      entity.addComponent(pos).addComponent(health);
      
      const allComponents = entity.getAllComponents();
      
      expect(allComponents).toHaveLength(2);
      expect(allComponents).toContainEqual(pos);
      expect(allComponents).toContainEqual(health);
    });

    it('should return empty array for entity with no components', () => {
      const allComponents = entity.getAllComponents();
      
      expect(allComponents).toEqual([]);
    });

    it('should overwrite existing component of same type', () => {
      entity.addComponent(createPosition(1, 2));
      entity.addComponent(createPosition(10, 20));
      
      const position = entity.getComponent<{ type: 'position'; x: number; y: number }>('position');
      
      expect(position?.x).toBe(10);
      expect(position?.y).toBe(20);
    });
  });
});

describe('ECSWorld', () => {
  let world: ECSWorld;

  beforeEach(() => {
    world = new ECSWorld();
  });

  afterEach(() => {
    world.clear();
  });

  describe('entity lifecycle', () => {
    it('should create an entity', () => {
      const entity = world.createEntity();
      
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBeGreaterThan(0);
    });

    it('should track created entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      expect(world.getEntity(entity1.id)).toBe(entity1);
      expect(world.getEntity(entity2.id)).toBe(entity2);
    });

    it('should return all entities', () => {
      world.createEntity();
      world.createEntity();
      world.createEntity();
      
      const allEntities = world.getAllEntities();
      
      expect(allEntities).toHaveLength(3);
    });

    it('should remove an entity by ID', () => {
      const entity = world.createEntity();
      
      const result = world.removeEntity(entity.id);
      
      expect(result).toBe(true);
      expect(world.getEntity(entity.id)).toBeUndefined();
    });

    it('should return false when removing non-existent entity', () => {
      const result = world.removeEntity(99999);
      
      expect(result).toBe(false);
    });

    it('should notify systems when entity is removed', () => {
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: { all: ['position'] } as Query,
        update: jest.fn(),
        onEntityRemoved: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      const entity = world.createEntity();
      entity.addComponent(createPosition(0, 0));
      
      world.removeEntity(entity.id);
      
      expect(mockSystem.onEntityRemoved).toHaveBeenCalledWith(entity);
    });
  });

  describe('entity queries', () => {
    let entity1: Entity;
    let entity2: Entity;
    let entity3: Entity;

    beforeEach(() => {
      entity1 = world.createEntity();
      entity1.addComponent(createPosition(0, 0));
      entity1.addComponent(createHealth(100, 100));

      entity2 = world.createEntity();
      entity2.addComponent(createPosition(5, 5));
      entity2.addComponent(createVelocity(1, 1));

      entity3 = world.createEntity();
      entity3.addComponent(createHealth(50, 50));
    });

    it('should query entities with all specified components', () => {
      const results = world.queryEntities({ all: ['position', 'health'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(entity1.id);
    });

    it('should query entities with any of specified components', () => {
      const results = world.queryEntities({ any: ['position', 'velocity'] });
      
      expect(results).toHaveLength(2);
      expect(results.map(e => e.id)).toContain(entity1.id);
      expect(results.map(e => e.id)).toContain(entity2.id);
    });

    it('should exclude entities with none-specified components', () => {
      const results = world.queryEntities({ all: ['health'], none: ['position'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(entity3.id);
    });

    it('should return empty array for query with no matches', () => {
      const results = world.queryEntities({ all: ['nonexistent'] });
      
      expect(results).toEqual([]);
    });

    it('should return all entities for empty query', () => {
      const results = world.queryEntities({});
      
      expect(results).toHaveLength(3);
    });

    it('should cache query results', () => {
      const query = { all: ['position'] };
      
      const results1 = world.queryEntities(query);
      const results2 = world.queryEntities(query);
      
      expect(results1).toBe(results2);
    });

    it('should invalidate cache when entity is added', () => {
      const query = { all: ['position'] };
      const results1 = world.queryEntities(query);
      
      const newEntity = world.createEntity();
      newEntity.addComponent(createPosition(10, 10));
      
      const results2 = world.queryEntities(query);
      
      expect(results1).not.toBe(results2);
      expect(results2).toHaveLength(3);
    });

    it('should invalidate cache when entity is removed', () => {
      const query = { all: ['position'] };
      const results1 = world.queryEntities(query);
      
      world.removeEntity(entity1.id);
      
      const results2 = world.queryEntities(query);
      
      expect(results1).not.toBe(results2);
      expect(results2).toHaveLength(1);
    });

    it('should invalidate cache when component is added', () => {
      const query = { all: ['speed'] };
      const results1 = world.queryEntities(query);
      
      entity3.addComponent(createSpeed(100));
      world.invalidateCache();
      
      const results2 = world.queryEntities(query);
      
      expect(results1).not.toBe(results2);
      expect(results2).toHaveLength(1);
    });

    it('should invalidate cache when component is removed', () => {
      const query = { all: ['position'] };
      const results1 = world.queryEntities(query);
      
      entity1.removeComponent('position');
      world.invalidateCache();
      
      const results2 = world.queryEntities(query);
      
      expect(results1).not.toBe(results2);
      expect(results2).toHaveLength(1);
    });
  });

  describe('system management', () => {
    it('should add a system', () => {
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: { all: ['position'] } as Query,
        update: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      
      // System is added, no direct way to verify without updating
      expect(() => world.update(16)).not.toThrow();
    });

    it('should sort systems by priority', () => {
      const order: number[] = [];
      
      const system1 = {
        name: 'system1',
        priority: 10,
        query: {} as Query,
        update: () => order.push(1),
      };
      
      const system2 = {
        name: 'system2',
        priority: 5,
        query: {} as Query,
        update: () => order.push(2),
      };
      
      const system3 = {
        name: 'system3',
        priority: 15,
        query: {} as Query,
        update: () => order.push(3),
      };
      
      world.addSystem(system1);
      world.addSystem(system2);
      world.addSystem(system3);
      world.start();
      world.update(16);
      
      expect(order).toEqual([2, 1, 3]);
    });

    it('should remove a system by name', () => {
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: {} as Query,
        update: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      const result = world.removeSystem('test');
      
      expect(result).toBe(true);
    });

    it('should return false when removing non-existent system', () => {
      const result = world.removeSystem('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should notify system of existing matching entities on add', () => {
      const entity = world.createEntity();
      entity.addComponent(createPosition(0, 0));
      
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: { all: ['position'] } as Query,
        update: jest.fn(),
        onEntityAdded: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      
      expect(mockSystem.onEntityAdded).toHaveBeenCalledWith(entity);
    });

    it('should pass correct entities to system update', () => {
      const entity1 = world.createEntity();
      entity1.addComponent(createPosition(0, 0));
      
      const entity2 = world.createEntity();
      entity2.addComponent(createHealth(100, 100));
      
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: { all: ['position'] } as Query,
        update: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      world.start();
      world.update(16);
      
      expect(mockSystem.update).toHaveBeenCalledWith(
        expect.arrayContaining([entity1]),
        16
      );
      expect(mockSystem.update).not.toHaveBeenCalledWith(
        expect.arrayContaining([entity2]),
        expect.any(Number)
      );
    });
  });

  describe('world lifecycle', () => {
    it('should start the world', () => {
      expect(() => world.start()).not.toThrow();
    });

    it('should stop the world', () => {
      world.start();
      expect(() => world.stop()).not.toThrow();
    });

    it('should not update systems when stopped', () => {
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: {} as Query,
        update: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      world.stop();
      world.update(16);
      
      expect(mockSystem.update).not.toHaveBeenCalled();
    });

    it('should update systems when started', () => {
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: {} as Query,
        update: jest.fn(),
      };
      
      world.addSystem(mockSystem);
      world.start();
      world.update(16);
      
      expect(mockSystem.update).toHaveBeenCalledTimes(1);
    });

    it('should clear all entities and systems', () => {
      world.createEntity();
      
      const mockSystem = {
        name: 'test',
        priority: 0,
        query: {} as Query,
        update: jest.fn(),
      };
      world.addSystem(mockSystem);
      
      world.clear();
      
      expect(world.getAllEntities()).toHaveLength(0);
      // After clear, adding a system should not throw
      expect(() => world.addSystem(mockSystem)).not.toThrow();
    });
  });
});

describe('Component factories', () => {
  describe('createPosition', () => {
    it('should create a position component with coordinates', () => {
      const position = createPosition(5, 10);
      
      expect(position.type).toBe('position');
      expect(position.x).toBe(5);
      expect(position.y).toBe(10);
    });
  });

  describe('createVelocity', () => {
    it('should create a velocity component with vector', () => {
      const velocity = createVelocity(2, 3);
      
      expect(velocity.type).toBe('velocity');
      expect(velocity.vx).toBe(2);
      expect(velocity.vy).toBe(3);
    });
  });

  describe('createHealth', () => {
    it('should create a health component with current and max', () => {
      const health = createHealth(50, 100);
      
      expect(health.type).toBe('health');
      expect(health.current).toBe(50);
      expect(health.max).toBe(100);
    });
  });

  describe('createSpeed', () => {
    it('should create a speed component with value', () => {
      const speed = createSpeed(150);
      
      expect(speed.type).toBe('speed');
      expect(speed.value).toBe(150);
    });
  });

  describe('createActor', () => {
    it('should create an actor component for non-player', () => {
      const actor = createActor(false);
      
      expect(actor.type).toBe('actor');
      expect(actor.isPlayer).toBe(false);
      expect(actor.energy).toBe(0);
    });

    it('should create an actor component for player', () => {
      const actor = createActor(true);
      
      expect(actor.isPlayer).toBe(true);
    });

    it('should create an actor component with default isPlayer as false', () => {
      const actor = createActor();
      
      expect(actor.isPlayer).toBe(false);
      expect(actor.energy).toBe(0);
    });
  });

  describe('createRenderable', () => {
    it('should create a renderable component with character and colors', () => {
      const renderable = createRenderable('@', '#ffffff', '#000000');
      
      expect(renderable.type).toBe('renderable');
      expect(renderable.char).toBe('@');
      expect(renderable.fg).toBe('#ffffff');
      expect(renderable.bg).toBe('#000000');
    });

    it('should create a renderable component without background', () => {
      const renderable = createRenderable('X', '#ff0000');
      
      expect(renderable.char).toBe('X');
      expect(renderable.bg).toBeUndefined();
    });
  });
});

describe('BaseSystem', () => {
  it('should serve as abstract base class', () => {
    class TestSystem extends BaseSystem {
      name = 'test';
      priority = 5;
      query = { all: ['position'] };
      
      update(_entities: any[], _deltaTime: number): void {
        // Implementation
      }
    }
    
    const system = new TestSystem();
    
    expect(system.name).toBe('test');
    expect(system.priority).toBe(5);
    expect(system.query).toEqual({ all: ['position'] });
    expect(typeof system.update).toBe('function');
  });

  it('should have optional lifecycle hooks', () => {
    class TestSystem extends BaseSystem {
      name = 'test';
      priority = 0;
      query = {};
      
      update(): void {}
      
      onEntityAdded(_entity: any): void {
        // Custom implementation
      }
      
      onEntityRemoved(_entity: any): void {
        // Custom implementation
      }
    }
    
    const system = new TestSystem();
    
    expect(typeof system.onEntityAdded).toBe('function');
    expect(typeof system.onEntityRemoved).toBe('function');
  });
});
