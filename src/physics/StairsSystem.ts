/**
 * Stairs System
 * Manages stair connections between world layers
 */

import { Position } from '../core/Types';
import { World } from '../world';
import { EventBus } from '../core/EventBus';

// Stair connection between layers
export interface StairLink {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  direction: 'up' | 'down';
}

export class StairsSystem {
  private stairLinks: Map<string, StairLink> = new Map();
  private eventBus: EventBus;

  constructor(_world: World, eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  private getStairKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Register a stair connection between two positions
   */
  registerStairLink(link: StairLink): void {
    const key = this.getStairKey(link.fromX, link.fromY, link.fromZ);
    this.stairLinks.set(key, link);
    
    this.eventBus.emit('stairs:linkRegistered', {
      from: { x: link.fromX, y: link.fromY, z: link.fromZ },
      to: { x: link.toX, y: link.toY, z: link.toZ },
      direction: link.direction
    });
  }

  /**
   * Get stair link at a position
   */
  getStairLink(x: number, y: number, z: number): StairLink | undefined {
    return this.stairLinks.get(this.getStairKey(x, y, z));
  }

  /**
   * Check if there's a stair connection at the given position
   */
  hasStairLink(x: number, y: number, z: number): boolean {
    return this.stairLinks.has(this.getStairKey(x, y, z));
  }

  /**
   * Get all registered stair links
   */
  getAllStairLinks(): StairLink[] {
    return Array.from(this.stairLinks.values());
  }

  /**
   * Remove a stair link
   */
  removeStairLink(x: number, y: number, z: number): boolean {
    const key = this.getStairKey(x, y, z);
    const link = this.stairLinks.get(key);
    if (link) {
      this.stairLinks.delete(key);
      this.eventBus.emit('stairs:linkRemoved', {
        from: { x, y, z },
        to: { x: link.toX, y: link.toY, z: link.toZ }
      });
      return true;
    }
    return false;
  }

  /**
   * Clear all stair links
   */
  clear(): void {
    this.stairLinks.clear();
    this.eventBus.emit('stairs:allLinksCleared', {});
  }

  /**
   * Check if an entity can ascend from their current position
   */
  canAscend(x: number, y: number, z: number): boolean {
    const link = this.getStairLink(x, y, z);
    return link !== undefined && link.direction === 'up';
  }

  /**
   * Check if an entity can descend from their current position
   */
  canDescend(x: number, y: number, z: number): boolean {
    const link = this.getStairLink(x, y, z);
    return link !== undefined && link.direction === 'down';
  }

  /**
   * Get the destination position when ascending
   */
  getAscendDestination(x: number, y: number, z: number): Position | null {
    const link = this.getStairLink(x, y, z);
    if (link && link.direction === 'up') {
      return { x: link.toX, y: link.toY, z: link.toZ };
    }
    return null;
  }

  /**
   * Get the destination position when descending
   */
  getDescendDestination(x: number, y: number, z: number): Position | null {
    const link = this.getStairLink(x, y, z);
    if (link && link.direction === 'down') {
      return { x: link.toX, y: link.toY, z: link.toZ };
    }
    return null;
  }
}
