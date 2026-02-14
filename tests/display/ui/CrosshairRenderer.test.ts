/**
 * @jest-environment jsdom
 */

/**
 * Crosshair Renderer Tests
 * Tests for the look mode cursor rendering
 */

import { CrosshairRenderer } from '../../../src/display/ui/CrosshairRenderer';
import { LookMode } from '../../../src/interaction/LookMode';
import { DisplayManager } from '../../../src/display';
import { Camera } from '../../../src/display';
import { ECSWorld, Entity } from '../../../src/ecs';
import { EventBus } from '../../../src/core/EventBus';
import { World } from '../../../src/world';
import { FOVSystem, Pathfinding } from '../../../src/physics';
import { ItemManager } from '../../../src/items';
import { PhysicsSystem } from '../../../src/physics';

describe('CrosshairRenderer', () => {
  let crosshairRenderer: CrosshairRenderer;
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

    // Setup display
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

    // Initialize world with player position to generate chunks
    world.setPlayerPosition(10, 10);

    lookMode = new LookMode(
      world,
      fovSystem,
      itemManager,
      physicsSystem,
      ecsWorld,
      eventBus,
      pathfinding
    );

    crosshairRenderer = new CrosshairRenderer(
      lookMode,
      displayManager,
      camera,
      world,
      ecsWorld,
      fovSystem,
      itemManager
    );
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('initialization', () => {
    it('should have default config', () => {
      const config = crosshairRenderer.getConfig();
      expect(config.highlightBgColor).toBe('#444400');
    });

    it('should accept custom config', () => {
      const customRenderer = new CrosshairRenderer(
        lookMode,
        displayManager,
        camera,
        world,
        ecsWorld,
        fovSystem,
        itemManager,
        { highlightBgColor: '#660000' }
      );
      
      const config = customRenderer.getConfig();
      expect(config.highlightBgColor).toBe('#660000');
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      crosshairRenderer.setConfig({ highlightBgColor: '#006600' });
      const config = crosshairRenderer.getConfig();
      expect(config.highlightBgColor).toBe('#006600');
    });

    it('should merge config updates', () => {
      crosshairRenderer.setConfig({ highlightBgColor: '#000066' });
      const config = crosshairRenderer.getConfig();
      expect(config.highlightBgColor).toBe('#000066');
    });
  });

  describe('render', () => {
    it('should not render when look mode is disabled', () => {
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should not render when cursor is outside viewport', () => {
      // Compute FOV at player position so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      // Move camera to a different position so cursor is outside viewport
      camera.setPosition(50, 50);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should render when look mode is enabled and cursor in viewport', () => {
      // Compute FOV at player position so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render highlight around cursor', () => {
      // Compute FOV at player position so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Should have called draw for surrounding tiles (8 positions)
      expect(drawSpy.mock.calls.length).toBeGreaterThanOrEqual(8);
    });

    it('should render at cursor position', () => {
      // Compute FOV at player position so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      // Move cursor (must stay within visible area)
      lookMode.moveCursor('east');
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Should have called draw multiple times
      expect(drawSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('should use configured colors', () => {
      crosshairRenderer.setConfig({
        highlightBgColor: '#ff0000'
      });
      
      // Compute FOV at player position so tiles are visible
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Check that configured colors are used in draw calls
      const coloredCall = drawSpy.mock.calls.find(call =>
        call[4] === '#ff0000'  // bg color is 5th argument
      );
      expect(coloredCall).toBeDefined();
    });
  });
});
