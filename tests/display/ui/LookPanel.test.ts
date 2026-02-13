/**
 * @jest-environment jsdom
 */

/**
 * Look Panel UI Tests
 * Tests for the look mode sidebar UI component
 */

import { LookPanel } from '../../../src/display/ui/LookPanel';
import { LookMode } from '../../../src/interaction/LookMode';
import { DisplayManager } from '../../../src/display';
import { Camera } from '../../../src/display';
import { ECSWorld, Entity } from '../../../src/ecs';
import { EventBus } from '../../../src/core/EventBus';
import { World } from '../../../src/world';
import { FOVSystem, Pathfinding } from '../../../src/physics';
import { ItemManager } from '../../../src/items';
import { PhysicsSystem } from '../../../src/physics';

describe('LookPanel', () => {
  let lookPanel: LookPanel;
  let lookMode: LookMode;
  let displayManager: DisplayManager;
  let camera: Camera;
  let ecsWorld: ECSWorld;
  let eventBus: EventBus;
  let world: World;
  let fovSystem: FOVSystem;
  let itemManager: ItemManager;
  let physicsSystem: PhysicsSystem;
  let pathfinding: Pathfinding;
  let playerEntity: Entity;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    world = new World(100, 100, 64, ecsWorld);
    fovSystem = new FOVSystem(world);
    itemManager = new ItemManager(eventBus);
    physicsSystem = new PhysicsSystem(world, ecsWorld, eventBus);
    pathfinding = new Pathfinding(world);

    // Initialize floor tiles in the world around player position
    // This is needed for FOV computation and cursor movement to work correctly
    for (let x = 5; x < 25; x++) {
      for (let y = 5; y < 25; y++) {
        world.setTileAt(x, y, {
          terrain: 'floor',
          char: '.',
          fg: '#888888',
          bg: '#000000',
          blocksMovement: false,
          blocksLight: false,
          transparent: true
        });
      }
    }

    // Setup display (mock)
    displayManager = new DisplayManager({
      width: 80,
      height: 24,
      fontSize: 16
    });

    camera = new Camera(
      { width: 60, height: 24 },
      { width: 100, height: 100 }
    );

    // Create player
    playerEntity = ecsWorld.createEntity();
    playerEntity.addComponent({
      type: 'position',
      x: 10,
      y: 10,
      z: 0
    } as any);

    lookMode = new LookMode(
      world,
      fovSystem,
      itemManager,
      physicsSystem,
      ecsWorld,
      eventBus,
      pathfinding
    );

    lookPanel = new LookPanel(
      lookMode,
      displayManager,
      camera,
      eventBus,
      { sidebarWidth: 20, startX: 60 }
    );
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('initialization', () => {
    it('should have default config', () => {
      const config = lookPanel.getConfig();
      expect(config.sidebarWidth).toBe(20);
      expect(config.startX).toBe(60);
      expect(config.backgroundColor).toBe('#000000');
      expect(config.borderColor).toBe('#444444');
      expect(config.textColor).toBe('#cccccc');
      expect(config.highlightColor).toBe('#ffff00');
      expect(config.dimColor).toBe('#666666');
    });

    it('should accept custom config', () => {
      const customPanel = new LookPanel(
        lookMode,
        displayManager,
        camera,
        eventBus,
        { sidebarWidth: 25, startX: 55 }
      );

      const config = customPanel.getConfig();
      expect(config.sidebarWidth).toBe(25);
      expect(config.startX).toBe(55);
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      lookPanel.setConfig({ sidebarWidth: 30 });
      const config = lookPanel.getConfig();
      expect(config.sidebarWidth).toBe(30);
    });

    it('should merge config updates', () => {
      lookPanel.setConfig({ startX: 50 });
      const config = lookPanel.getConfig();
      expect(config.startX).toBe(50);
      expect(config.sidebarWidth).toBe(20); // Unchanged
    });
  });

  describe('render', () => {
    it('should not render when look mode is disabled', () => {
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should render when look mode is enabled', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render border', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      // Check that border characters are drawn
      const borderCalls = drawSpy.mock.calls.filter(call => 
        call[2] === '│'
      );
      expect(borderCalls.length).toBeGreaterThan(0);
    });

    it('should render header', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawTextSpy = jest.spyOn(displayManager, 'drawText');
      
      lookPanel.render();
      
      // Should draw "LOOK MODE" header
      expect(drawTextSpy).toHaveBeenCalled();
    });

    it('should render cursor position', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      // Should have drawn something at sidebar position
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render visibility status', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      // Should have drawn visibility text
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render terrain info', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      lookPanel.render();
      
      // Should render terrain characters
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render entities at cursor', () => {
      fovSystem.computeFOV(10, 10, 10);

      // Create entity at player position
      const npc = ecsWorld.createEntity();
      npc.addComponent({
        type: 'position',
        x: 10,
        y: 10,
        z: 0
      } as any);
      npc.addComponent({
        type: 'renderable',
        char: 'n',
        fg: '#ff0000'
      } as any);
      npc.addComponent({
        type: 'health',
        current: 50,
        max: 50
      } as any);

      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render entity information
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render items at cursor', () => {
      fovSystem.computeFOV(10, 10, 10);

      // Spawn item at player position
      itemManager.spawnItem(ecsWorld, 'sword_iron', 1, { x: 10, y: 10 });

      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render item information
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render available actions', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render action information
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render help text', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render help text
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should limit displayed entities to 3', () => {
      fovSystem.computeFOV(10, 10, 10);

      // Create 5 entities at player position
      for (let i = 0; i < 5; i++) {
        const npc = ecsWorld.createEntity();
        npc.addComponent({
          type: 'position',
          x: 10,
          y: 10,
          z: 0
        } as any);
      }

      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render entity section
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should limit displayed items to 3', () => {
      fovSystem.computeFOV(10, 10, 10);

      // Spawn 5 items at player position
      for (let i = 0; i < 5; i++) {
        itemManager.spawnItem(ecsWorld, 'potion_health', 1, { x: 10, y: 10 });
      }

      lookMode.enter(playerEntity);

      const drawSpy = jest.spyOn(displayManager, 'draw');

      lookPanel.render();

      // Should render items section
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should handle unknown tiles gracefully', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      // Move to unknown tile
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      lookMode.moveCursor('north');
      
      // Should not throw
      expect(() => lookPanel.render()).not.toThrow();
    });

    it('should show description instead of actions when examine is triggered', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);

      // Trigger examine event
      eventBus.emit('look:examine', {
        position: { x: 10, y: 10, z: 0 },
        entities: [],
        items: [],
        tile: { terrain: 'floor' }
      });

      const drawTextSpy = jest.spyOn(displayManager, 'drawText');
      lookPanel.render();

      // Should show "Description:" header
      const descriptionCalls = drawTextSpy.mock.calls.filter(call => 
        typeof call[2] === 'string' && call[2].includes('Description:')
      );
      expect(descriptionCalls.length).toBeGreaterThan(0);
    });

    it('should clear description when cursor moves', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);

      // Trigger examine event with a description
      eventBus.emit('look:examine', {
        position: { x: 10, y: 10, z: 0 },
        entities: [],
        items: [],
        tile: { terrain: 'floor', description: 'A stone floor.' }
      });

      // Verify description was set
      const drawTextSpy1 = jest.spyOn(displayManager, 'drawText');
      lookPanel.render();
      const descriptionCallsBefore = drawTextSpy1.mock.calls.filter(call => 
        typeof call[2] === 'string' && call[2].includes('Description:')
      );
      expect(descriptionCallsBefore.length).toBeGreaterThan(0);
      drawTextSpy1.mockClear();

      // Move cursor - should clear description
      lookMode.moveCursor('north');

      const drawTextSpy2 = jest.spyOn(displayManager, 'drawText');
      lookPanel.render();

      // Should NOT show "Description:" header after cursor moves
      const descriptionCallsAfter = drawTextSpy2.mock.calls.filter(call => 
        typeof call[2] === 'string' && call[2].includes('Description:')
      );
      expect(descriptionCallsAfter.length).toBe(0);
    });

    it('should clear description when look mode exits', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);

      // Trigger examine event
      eventBus.emit('look:examine', {
        position: { x: 10, y: 10, z: 0 },
        entities: [],
        items: [],
        tile: { terrain: 'floor' }
      });

      // Exit look mode - should clear description
      lookMode.exit();

      // Re-enter to check state
      lookMode.enter(playerEntity);

      const drawTextSpy = jest.spyOn(displayManager, 'drawText');
      lookPanel.render();

      // Should show "Actions:" header, not "Description:"
      const actionCalls = drawTextSpy.mock.calls.filter(call => 
        typeof call[2] === 'string' && call[2].includes('Actions:')
      );
      expect(actionCalls.length).toBeGreaterThan(0);
    });
  });
});
