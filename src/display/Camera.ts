/**
 * Camera
 * Viewport management for the game world
 */

import { Position, Size } from '../core/Types';

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
