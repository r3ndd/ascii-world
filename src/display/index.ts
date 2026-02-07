/**
 * Display module
 * Rendering and viewport management using rot.js
 */

import * as ROT from 'rot-js';
import { Position, Size } from '../core/Types';

export interface DisplayConfig {
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fg?: string;
  bg?: string;
  spacing?: number;
  forceSquareRatio?: boolean;
}

export class DisplayManager {
  private display: ROT.Display;
  private config: DisplayConfig;

  constructor(config: DisplayConfig) {
    this.config = {
      fontSize: 16,
      fontFamily: 'monospace',
      fg: '#cccccc',
      bg: '#000000',
      spacing: 1,
      forceSquareRatio: true,
      ...config
    };

    this.display = new ROT.Display({
      width: this.config.width,
      height: this.config.height,
      fontSize: this.config.fontSize,
      fontFamily: this.config.fontFamily,
      fg: this.config.fg,
      bg: this.config.bg,
      spacing: this.config.spacing,
      forceSquareRatio: this.config.forceSquareRatio
    });
  }

  getDisplay(): ROT.Display {
    return this.display;
  }

  getContainer(): HTMLElement | null {
    return this.display.getContainer();
  }

  draw(x: number, y: number, ch: string | string[], fg?: string, bg?: string): void {
    this.display.draw(x, y, ch, fg ?? null, bg ?? null);
  }

  drawText(x: number, y: number, text: string, maxWidth?: number): number {
    return this.display.drawText(x, y, text, maxWidth);
  }

  clear(): void {
    this.display.clear();
  }

  getSize(): Size {
    const options = this.display.getOptions();
    return {
      width: options.width,
      height: options.height
    };
  }

  computeSize(availWidth: number, availHeight: number): [number, number] {
    return this.display.computeSize(availWidth, availHeight);
  }

  eventToPosition(e: Event): [number, number] | null {
    return (this.display as any).eventToPosition(e);
  }
}

export class Camera {
  private position: Position;
  private viewportSize: Size;
  private worldBounds: { minX: number; minY: number; maxX: number; maxY: number };

  constructor(viewportSize: Size, worldBounds: { width: number; height: number }) {
    this.position = { x: 0, y: 0 };
    this.viewportSize = viewportSize;
    this.worldBounds = {
      minX: 0,
      minY: 0,
      maxX: worldBounds.width - 1,
      maxY: worldBounds.height - 1
    };
  }

  setPosition(x: number, y: number): void {
    const halfWidth = Math.floor(this.viewportSize.width / 2);
    const halfHeight = Math.floor(this.viewportSize.height / 2);

    let newX = x - halfWidth;
    let newY = y - halfHeight;

    // Clamp to world bounds
    newX = Math.max(this.worldBounds.minX, Math.min(newX, this.worldBounds.maxX - this.viewportSize.width + 1));
    newY = Math.max(this.worldBounds.minY, Math.min(newY, this.worldBounds.maxY - this.viewportSize.height + 1));

    this.position = { x: newX, y: newY };
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getViewportSize(): Size {
    return { ...this.viewportSize };
  }

  worldToScreen(worldX: number, worldY: number): Position | null {
    const screenX = worldX - this.position.x;
    const screenY = worldY - this.position.y;

    if (screenX < 0 || screenX >= this.viewportSize.width ||
        screenY < 0 || screenY >= this.viewportSize.height) {
      return null;
    }

    return { x: screenX, y: screenY };
  }

  screenToWorld(screenX: number, screenY: number): Position {
    return {
      x: this.position.x + screenX,
      y: this.position.y + screenY
    };
  }

  isInViewport(worldX: number, worldY: number): boolean {
    return worldX >= this.position.x &&
           worldX < this.position.x + this.viewportSize.width &&
           worldY >= this.position.y &&
           worldY < this.position.y + this.viewportSize.height;
  }
}

export interface Renderable {
  getChar(): string;
  getForeground(): string;
  getBackground(): string;
  getPosition(): Position;
  isVisible(): boolean;
}

import { ECSWorld } from '../ecs';

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
