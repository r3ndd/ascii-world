/**
 * Content loading system
 * Handles loading content packs (items, creatures, recipes, terrains)
 */

import { EventBus } from '../core/EventBus';
import { ItemTemplate } from '../items';
import { TERRAIN, TerrainType } from '../world';

export interface CreatureTemplate {
  id: string;
  name: string;
  description: string;
  character: string;
  foreground: string;
  background?: string;
  health: number;
  speed: number;
  faction?: string;
  tags: string[];
  ai?: {
    type: string;
    aggression: number;
    visionRange: number;
  };
  loot?: string[];
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'crafting' | 'construction' | 'cooking';
  ingredients: RecipeIngredient[];
  results: RecipeIngredient[];
  timeCost: number;
  requiredTools?: string[];
  requiredSkills?: Record<string, number>;
  station?: string;
}

export interface TerrainDefinition {
  id: string;
  name: string;
  character: string;
  foreground: string;
  background?: string;
  blocksMovement: boolean;
  blocksLight: boolean;
  transparent: boolean;
  tags?: string[];
}

export interface ContentPack {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  items?: ItemTemplate[];
  creatures?: CreatureTemplate[];
  recipes?: Recipe[];
  terrains?: TerrainDefinition[];
}

export class ContentLoader {
  private eventBus: EventBus;
  private loadedPacks: Map<string, ContentPack> = new Map();
  private terrainOverrides: Map<string, TerrainDefinition> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Load a content pack from JSON data
   */
  loadContentPack(pack: ContentPack): void {
    // Check dependencies
    if (pack.dependencies) {
      for (const dep of pack.dependencies) {
        if (!this.loadedPacks.has(dep)) {
          throw new Error(`Content pack "${pack.id}" requires dependency "${dep}" which is not loaded`);
        }
      }
    }

    this.loadedPacks.set(pack.id, pack);
    this.eventBus.emit('content:packLoaded', { packId: pack.id, name: pack.name });
  }

  /**
   * Load content pack from JSON string
   */
  loadContentPackFromJSON(json: string): void {
    const pack: ContentPack = JSON.parse(json);
    this.loadContentPack(pack);
  }

  /**
   * Get all loaded content packs
   */
  getLoadedPacks(): ContentPack[] {
    return Array.from(this.loadedPacks.values());
  }

  /**
   * Get content pack by ID
   */
  getPack(id: string): ContentPack | undefined {
    return this.loadedPacks.get(id);
  }

  /**
   * Get all item templates from all loaded packs
   */
  getAllItemTemplates(): ItemTemplate[] {
    const templates: ItemTemplate[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.items) {
        templates.push(...pack.items);
      }
    }
    return templates;
  }

  /**
   * Get all creature templates
   */
  getAllCreatureTemplates(): CreatureTemplate[] {
    const templates: CreatureTemplate[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.creatures) {
        templates.push(...pack.creatures);
      }
    }
    return templates;
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): Recipe[] {
    const recipes: Recipe[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.recipes) {
        recipes.push(...pack.recipes);
      }
    }
    return recipes;
  }

  /**
   * Get terrain definitions
   */
  getAllTerrainDefinitions(): TerrainDefinition[] {
    const terrains: TerrainDefinition[] = [];
    for (const pack of this.loadedPacks.values()) {
      if (pack.terrains) {
        terrains.push(...pack.terrains);
      }
    }
    return terrains;
  }

  /**
   * Register a terrain override
   */
  registerTerrain(definition: TerrainDefinition): void {
    this.terrainOverrides.set(definition.id, definition);
  }

  /**
   * Get terrain definition
   */
  getTerrain(id: string): TerrainDefinition | undefined {
    return this.terrainOverrides.get(id);
  }

  /**
   * Apply terrain overrides to TERRAIN registry
   */
  applyTerrainOverrides(): void {
    for (const [id, definition] of this.terrainOverrides) {
      const terrainKey = id as TerrainType;
      if (TERRAIN[terrainKey]) {
        TERRAIN[terrainKey] = {
          ...TERRAIN[terrainKey],
          char: definition.character,
          fg: definition.foreground,
          bg: definition.background || TERRAIN[terrainKey].bg,
          blocksMovement: definition.blocksMovement,
          blocksLight: definition.blocksLight,
          transparent: definition.transparent,
          terrain: terrainKey
        };
      }
    }
  }

  /**
   * Clear all loaded content
   */
  clear(): void {
    this.loadedPacks.clear();
    this.terrainOverrides.clear();
  }
}
