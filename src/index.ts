/**
 * ASCII World Game Engine
 * 
 * Main entry point for the engine.
 */

export { Engine } from './core/Engine';
export { Config } from './core/Config';
export { EventBus, globalEventBus } from './core/EventBus';
export { Position, Size, Bounds, Direction, ChunkCoord } from './core/Types';

// ECS exports
export {
  ECSWorld,
  Entity,
  EntityId,
  Component,
  System,
  BaseSystem,
  Query,
  createPosition,
  createHealth,
  createSpeed,
  createActor,
  createRenderable
} from './ecs';

// Display exports
export {
  DisplayManager,
  DisplayConfig,
  Camera,
  Renderer,
  Renderable
} from './display';

// World exports
export {
  World,
  Chunk,
  ChunkManager,
  UpdateScheduler,
  MapManager,
  MapMetadata,
  Tile,
  TerrainType,
  TERRAIN
} from './world';

// Time/Turn exports
export {
  TurnManager,
  SpeedSystem,
  Action,
  ActionType,
  Actor,
  DeferredUpdateSystem,
  CatchUpCalculator,
  PostHocUpdateQueue
} from './time';

// Physics exports
export {
  PhysicsSystem,
  FOVSystem,
  LightingSystem,
  Pathfinding
} from './physics';

// Config exports
export { WORLD_DEFAULTS } from './config/WorldDefaults';
export { ACTION_COSTS } from './config/ActionCosts';

// Version
export const VERSION = '0.1.0';
