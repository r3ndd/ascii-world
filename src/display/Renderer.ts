/**
 * Renderer
 * Rendering orchestration
 */

import { Position } from '../core/Types';
import { ECSWorld } from '../ecs';
import { DisplayManager } from './DisplayManager';
import { Camera } from './Camera';

export interface Renderable {
  getChar(): string;
  getForeground(): string;
  getBackground(): string;
  getPosition(): Position;
  isVisible(): boolean;
}

export class Renderer {
  private displayManager: DisplayManager;
  private camera: Camera;
  private ecsWorld: ECSWorld;
  private fovSystem: { isVisible: (x: number, y: number) => boolean } | null = null;

  constructor(displayManager: DisplayManager, camera: Camera, ecsWorld: ECSWorld) {
    this.displayManager = displayManager;
    this.camera = camera;
    this.ecsWorld = ecsWorld;
  }

  setFOVSystem(fovSystem: { isVisible: (x: number, y: number) => boolean }): void {
    this.fovSystem = fovSystem;
  }

  render(): void {
    // Query entities with renderable components
    const entities = this.ecsWorld.queryEntities({ all: ['position', 'renderable'] });

    for (const entity of entities) {
      const position = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      const renderable = entity.getComponent<{ type: 'renderable'; char: string; fg: string; bg?: string }>('renderable');

      if (!position || !renderable) continue;

      // Check FOV visibility if FOV system is set
      if (this.fovSystem && !this.fovSystem.isVisible(position.x, position.y)) {
        continue;
      }

      if (this.camera.isInViewport(position.x, position.y)) {
        const screenPos = this.camera.worldToScreen(position.x, position.y);
        if (screenPos) {
          this.displayManager.draw(
            screenPos.x,
            screenPos.y,
            renderable.char,
            renderable.fg,
            renderable.bg
          );
        }
      }
    }
  }

  renderText(x: number, y: number, text: string, maxWidth?: number): number {
    return this.displayManager.drawText(x, y, text, maxWidth);
  }

  getCamera(): Camera {
    return this.camera;
  }

  getDisplayManager(): DisplayManager {
    return this.displayManager;
  }

  getECSWorld(): ECSWorld {
    return this.ecsWorld;
  }
}
