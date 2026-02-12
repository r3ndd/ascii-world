/**
 * Dynamic Lighting System
 * Using rot.js lighting algorithms
 */

import * as ROT from 'rot-js';
import { World } from '../world';

export class LightingSystem {
  private world: World;
  private _lightSources: Map<string, { x: number; y: number; color: [number, number, number]; intensity: number }> = new Map();
  private lighting: ROT.Lighting;
  private emittedLight: Map<string, [number, number, number]> = new Map();

  constructor(world: World) {
    this.world = world;
    
    this.lighting = new ROT.Lighting(
      (x, y) => {
        const tile = this.world.getTileAt(x, y);
        return tile ? (tile.transparent ? 1 : 0) : 0;
      },
      { range: 10, passes: 2 }
    );

    this.lighting.setFOV(new ROT.FOV.PreciseShadowcasting((x, y) => {
      const tile = this.world.getTileAt(x, y);
      return tile ? !tile.blocksLight : false;
    }));
  }

  addLightSource(id: string, x: number, y: number, color: [number, number, number], intensity: number): void {
    this._lightSources.set(id, { x, y, color, intensity });
    this.updateLightSource(id);
  }

  removeLightSource(id: string): void {
    this._lightSources.delete(id);
    this.lighting.clearLights();
    this.rebuildLighting();
  }

  moveLightSource(id: string, x: number, y: number): void {
    const source = this._lightSources.get(id);
    if (source) {
      source.x = x;
      source.y = y;
      this.updateLightSource(id);
    }
  }

  private updateLightSource(id: string): void {
    const source = this._lightSources.get(id);
    if (!source) return;

    this.lighting.clearLights();
    this.rebuildLighting();
  }

  private rebuildLighting(): void {
    for (const source of this._lightSources.values()) {
      this.lighting.setLight(source.x, source.y, source.color);
    }

    this.emittedLight.clear();
    this.lighting.compute((x, y, color) => {
      this.emittedLight.set(`${x},${y}`, color);
    });
  }

  getLightAt(x: number, y: number): [number, number, number] | null {
    return this.emittedLight.get(`${x},${y}`) || null;
  }

  reset(): void {
    this._lightSources.clear();
    this.lighting.clearLights();
    this.emittedLight.clear();
  }
}
