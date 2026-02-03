/**
 * Content factory for testing
 * Provides functions to create test content templates and packs
 */

import { ItemTemplate, ItemCategory } from '../../src/items';
import { CreatureTemplate, Recipe, ContentPack, TerrainDefinition, MapDefinition } from '../../src/content';

/**
 * Create a test item template
 */
export function createTestItemTemplate(
  id: string,
  overrides: Partial<ItemTemplate> = {}
): ItemTemplate {
  return {
    id,
    name: `Test ${id}`,
    description: `A test item with ID ${id}`,
    category: ItemCategory.MISC,
    character: '?',
    foreground: '#ffffff',
    properties: {
      weight: 1,
      volume: 1,
    },
    ...overrides,
  };
}

/**
 * Create a test weapon template
 */
export function createTestWeaponTemplate(
  id: string,
  damage: number = 10
): ItemTemplate {
  return createTestItemTemplate(id, {
    category: ItemCategory.WEAPON,
    name: `Test Weapon ${id}`,
    character: '/',
    foreground: '#cccccc',
    properties: {
      weight: 1.5,
      volume: 3,
      durability: 100,
      maxDurability: 100,
      value: 50,
      metadata: { damage },
    },
  });
}

/**
 * Create a test consumable template
 */
export function createTestConsumableTemplate(
  id: string,
  stackable: boolean = true,
  maxStack: number = 20
): ItemTemplate {
  return createTestItemTemplate(id, {
    category: ItemCategory.CONSUMABLE,
    name: `Test Consumable ${id}`,
    character: '!',
    foreground: '#ff0000',
    properties: {
      weight: 0.1,
      volume: 0.1,
      stackable,
      maxStack,
      value: 10,
    },
  });
}

/**
 * Create a test creature template
 */
export function createTestCreatureTemplate(
  id: string,
  overrides: Partial<CreatureTemplate> = {}
): CreatureTemplate {
  return {
    id,
    name: `Test Creature ${id}`,
    description: `A test creature with ID ${id}`,
    character: 'c',
    foreground: '#ff00ff',
    health: 50,
    speed: 100,
    faction: 'neutral',
    tags: ['test'],
    ...overrides,
  };
}

/**
 * Create a test recipe
 */
export function createTestRecipe(
  id: string,
  ingredients: Array<{ itemId: string; quantity: number }> = [],
  results: Array<{ itemId: string; quantity: number }> = []
): Recipe {
  return {
    id,
    name: `Test Recipe ${id}`,
    description: `A test recipe with ID ${id}`,
    category: 'crafting',
    ingredients,
    results: results.length > 0 ? results : [{ itemId: 'test_item', quantity: 1 }],
    timeCost: 100,
  };
}

/**
 * Create a test terrain definition
 */
export function createTestTerrainDefinition(
  id: string,
  overrides: Partial<TerrainDefinition> = {}
): TerrainDefinition {
  return {
    id,
    name: `Test Terrain ${id}`,
    character: '.',
    foreground: '#888888',
    background: '#000000',
    blocksMovement: false,
    blocksLight: false,
    transparent: true,
    ...overrides,
  };
}

/**
 * Create a minimal test content pack
 */
export function createTestContentPack(
  id: string = 'test_pack',
  options: {
    items?: ItemTemplate[];
    creatures?: CreatureTemplate[];
    recipes?: Recipe[];
    terrains?: TerrainDefinition[];
  } = {}
): ContentPack {
  return {
    id,
    name: `Test Content Pack ${id}`,
    version: '1.0.0',
    author: 'Test Author',
    description: `A test content pack with ID ${id}`,
    items: options.items ?? [],
    creatures: options.creatures ?? [],
    recipes: options.recipes ?? [],
    terrains: options.terrains ?? [],
  };
}

/**
 * Create a test map definition
 */
export function createTestMapDefinition(
  id: string,
  overrides: Partial<MapDefinition> = {}
): MapDefinition {
  return {
    id,
    name: `Test Map ${id}`,
    description: `A test map with ID ${id}`,
    width: 100,
    height: 100,
    chunkSize: 16,
    ...overrides,
  };
}
