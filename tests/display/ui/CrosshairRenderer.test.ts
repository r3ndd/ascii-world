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
import { FOVSystem } from '../../../src/physics';
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
  let playerEntity: Entity;

  beforeEach(() => {
    eventBus = new EventBus();
    ecsWorld = new ECSWorld(eventBus);
    world = new World(100, 100, 64, ecsWorld);
    fovSystem = new FOVSystem(world);
    itemManager = new ItemManager(eventBus);
    physicsSystem = new PhysicsSystem(world, ecsWorld, eventBus);

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

    lookMode = new LookMode(
      world,
      fovSystem,
      itemManager,
      physicsSystem,
      ecsWorld,
      eventBus
    );

    crosshairRenderer = new CrosshairRenderer(
      lookMode,
      displayManager,
      camera
    );
  });

  afterEach(() => {
    ecsWorld.clear();
  });

  describe('initialization', () => {
    it('should have default config', () => {
      const config = crosshairRenderer.getConfig();
      expect(config.fgColor).toBe('#ffff00');
      expect(config.bgColor).toBe('#444444');
      expect(config.boxChars.topLeft).toBe('┌');
      expect(config.boxChars.bottomRight).toBe('┘');
    });

    it('should accept custom config', () => {
      const customRenderer = new CrosshairRenderer(
        lookMode,
        displayManager,
        camera,
        { fgColor: '#ff0000', bgColor: '#000000' }
      );
      
      const config = customRenderer.getConfig();
      expect(config.fgColor).toBe('#ff0000');
      expect(config.bgColor).toBe('#000000');
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      crosshairRenderer.setConfig({ fgColor: '#00ff00' });
      const config = crosshairRenderer.getConfig();
      expect(config.fgColor).toBe('#00ff00');
    });

    it('should merge config updates', () => {
      crosshairRenderer.setConfig({ bgColor: '#111111' });
      const config = crosshairRenderer.getConfig();
      expect(config.bgColor).toBe('#111111');
      expect(config.fgColor).toBe('#ffff00'); // Unchanged
    });
  });

  describe('render', () => {
    it('should not render when look mode is disabled', () => {
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should not render when cursor is outside viewport', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      // Move cursor far away
      for (let i = 0; i < 100; i++) {
        lookMode.moveCursor('east');
      }
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should render when look mode is enabled and cursor in viewport', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should render box corners', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Check that corner characters are drawn
      const corners = ['┌', '┐', '└', '┘'];
      corners.forEach(corner => {
        const cornerCall = drawSpy.mock.calls.find(call => call[2] === corner);
        expect(cornerCall).toBeDefined();
      });
    });

    it('should render box edges', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Check that edge characters are drawn
      const edges = ['─', '│'];
      edges.forEach(edge => {
        const edgeCall = drawSpy.mock.calls.find(call => call[2] === edge);
        expect(edgeCall).toBeDefined();
      });
    });

    it('should render center highlight', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Center should be drawn with different colors
      const centerCall = drawSpy.mock.calls.find(call =>
        call[3] === '#ffffff' && call[4] === '#666666'
      );
      expect(centerCall).toBeDefined();
    });

    it('should render at cursor position', () => {
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      // Move cursor
      lookMode.moveCursor('east');
      lookMode.moveCursor('south');
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Should have called draw multiple times
      expect(drawSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('should use configured colors', () => {
      crosshairRenderer.setConfig({
        fgColor: '#ff0000',
        bgColor: '#00ff00'
      });
      
      fovSystem.computeFOV(10, 10, 10);
      lookMode.enter(playerEntity);
      
      const drawSpy = jest.spyOn(displayManager, 'draw');
      
      crosshairRenderer.render();
      
      // Check that configured colors are used
      const coloredCall = drawSpy.mock.calls.find(call =>
        call[3] === '#ff0000' && call[4] === '#00ff00'
      );
      expect(coloredCall).toBeDefined();
    });
  });
});
