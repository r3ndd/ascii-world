/**
 * System definitions
 */

import { Entity } from './Entity';

// Query for filtering entities
export interface Query {
  all?: string[];
  any?: string[];
  none?: string[];
}

// System interface
export interface System {
  readonly name: string;
  readonly priority: number;
  query: Query;
  update(entities: Entity[], deltaTime: number): void;
  onEntityAdded?(entity: Entity): void;
  onEntityRemoved?(entity: Entity): void;
}

// Base system class for convenience
export abstract class BaseSystem implements System {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract query: Query;
  
  abstract update(entities: Entity[], deltaTime: number): void;
  
  onEntityAdded?(entity: Entity): void;
  onEntityRemoved?(entity: Entity): void;
}
