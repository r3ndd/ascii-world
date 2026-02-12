/**
 * Pathfinding
 * A* and Dijkstra path algorithms using rot.js
 */

import * as ROT from 'rot-js';
import { Position } from '../core/Types';
import { World } from '../world';

export class Pathfinding {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): Position[] | null {
    const path: Position[] = [];

    const astar = new ROT.Path.AStar(endX, endY, (x, y) => {
      return this.world.isValidPosition(x, y);
    }, { topology: 4 });

    let found = false;
    astar.compute(startX, startY, (x, y) => {
      if (x === endX && y === endY) {
        found = true;
      }
      path.push({ x, y });
    });

    return found ? path : null;
  }

  findPathDijkstra(startX: number, startY: number, targetCallback: (x: number, y: number) => boolean): Position[] | null {
    // Find the target position first by exploring the map
    // We need to determine what the target coordinates are
    let targetX: number | null = null;
    let targetY: number | null = null;
    
    // Search a reasonable area for the target
    const searchRadius = 50;
    for (let y = startY - searchRadius; y <= startY + searchRadius; y++) {
      for (let x = startX - searchRadius; x <= startX + searchRadius; x++) {
        if (targetCallback(x, y)) {
          targetX = x;
          targetY = y;
          break;
        }
      }
      if (targetX !== null) break;
    }
    
    if (targetX === null || targetY === null) {
      return null;
    }
    
    // Use Dijkstra from the target to find path back to start
    // (Dijkstra constructor takes the target, compute takes the start)
    const dijkstra = new ROT.Path.Dijkstra(targetX, targetY, (x, y) => {
      return this.world.isValidPosition(x, y);
    }, { topology: 4 });

    const path: Position[] = [];

    // Compute path from start back to target
    dijkstra.compute(startX, startY, (x, y) => {
      path.push({ x, y });
    });

    // Path is returned from start to target (inclusive)
    // Verify the path actually reached the target
    if (path.length === 0 || !targetCallback(path[path.length - 1].x, path[path.length - 1].y)) {
      return null;
    }

    return path;
  }
}
