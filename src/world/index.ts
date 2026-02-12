/**
 * World module
 * World, chunk, and map management
 */

// Terrain and tile definitions
export * from './WorldConfig';

// Chunk - 64x64 tile storage
export * from './Chunk';

// Update scheduling
export * from './UpdateScheduler';

// Chunk lifecycle management
export * from './ChunkManager';

// World container (multi-layer)
export * from './World';

// Map metadata
export * from './MapMetadata';

// Map management
export * from './MapManager';
