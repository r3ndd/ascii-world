/**
 * Field of View System
 * Using rot.js FOV algorithms
 */

import * as ROT from 'rot-js';
import { Position } from '../core/Types';
import { World } from '../world';

export class FOVSystem {
  private world: World;
  private visibleTiles: Set<string> = new Set();
  private exploredTiles: Set<string> = new Set();

  constructor(world: World) {
    this.world = world;
  }

  private getTileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  computeFOV(originX: number, originY: number, radius: number): Position[] {
    const visible: Position[] = [];
    this.visibleTiles.clear();

    // Use rot.js FOV
    const fov = new ROT.FOV.PreciseShadowcasting((x, y) => {
      const tile = this.world.getTileAt(x, y);
      return tile ? !tile.blocksLight : false;
    });

    fov.compute(originX, originY, radius, (x, y, _r, _visibility) => {
      visible.push({ x, y });
      this.visibleTiles.add(this.getTileKey(x, y));
      this.exploredTiles.add(this.getTileKey(x, y));
    });

    return visible;
  }

  isVisible(x: number, y: number): boolean {
    return this.visibleTiles.has(this.getTileKey(x, y));
  }

  isExplored(x: number, y: number): boolean {
    return this.exploredTiles.has(this.getTileKey(x, y));
  }

  getVisibleTiles(): Position[] {
    return Array.from(this.visibleTiles).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  }

  reset(): void {
    this.visibleTiles.clear();
  }
}
