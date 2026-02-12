/**
 * World configuration and terrain definitions
 */

// Terrain types
export type TerrainType = 'floor' | 'wall' | 'water' | 'tree' | 'door' | 'stairs_up' | 'stairs_down';

// Tile data for a single tile
export interface Tile {
  terrain: TerrainType;
  blocksMovement: boolean;
  blocksLight: boolean;
  transparent: boolean;
  char?: string;
  fg?: string;
  bg?: string;
}

// Default terrain definitions
export const TERRAIN: Record<TerrainType, Tile> = {
  floor: {
    terrain: 'floor',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '.',
    fg: '#888888',
    bg: '#000000'
  },
  wall: {
    terrain: 'wall',
    blocksMovement: true,
    blocksLight: true,
    transparent: false,
    char: '#',
    fg: '#cccccc',
    bg: '#444444'
  },
  water: {
    terrain: 'water',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '~',
    fg: '#0088ff',
    bg: '#000044'
  },
  tree: {
    terrain: 'tree',
    blocksMovement: true,
    blocksLight: false,
    transparent: true,
    char: 'T',
    fg: '#00aa00',
    bg: '#000000'
  },
  door: {
    terrain: 'door',
    blocksMovement: true,
    blocksLight: true,
    transparent: false,
    char: '+',
    fg: '#8b4513',
    bg: '#000000'
  },
  stairs_up: {
    terrain: 'stairs_up',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '>',
    fg: '#ffff00',
    bg: '#000000'
  },
  stairs_down: {
    terrain: 'stairs_down',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    char: '<',
    fg: '#ffff00',
    bg: '#000000'
  }
};

// Layer configuration for multi-layer worlds
export interface LayerConfig {
  width: number;
  height: number;
}
