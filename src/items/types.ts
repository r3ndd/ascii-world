/**
 * Item type definitions
 * Core types and enums for the item system
 */

/**
 * Item categories
 */
export enum ItemCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  CONSUMABLE = 'consumable',
  TOOL = 'tool',
  MATERIAL = 'material',
  CONTAINER = 'container',
  MISC = 'misc'
}

/**
 * Item properties - configuration for item templates
 */
export interface ItemProperties {
  weight: number;               // Weight in kg
  volume: number;               // Volume in liters
  durability?: number;          // Current durability
  maxDurability?: number;       // Maximum durability
  stackable?: boolean;          // Can stack with same items
  maxStack?: number;            // Maximum stack size
  value?: number;               // Base value/cost
  quality?: number;             // Quality level (1-100)
  metadata?: Record<string, unknown>; // Custom properties
}

/**
 * Item template - static definition loaded from content packs
 */
export interface ItemTemplate {
  id: string;                   // Unique template ID
  name: string;                 // Display name
  description: string;          // Description text
  category: ItemCategory;         // Item category
  character: string;            // Display character
  foreground: string;           // Foreground color
  background?: string;          // Background color
  properties: ItemProperties;   // Item properties
  tags?: string[];              // Item tags
}

/**
 * Legacy item instance data - for save migration
 * @deprecated Use ECS entities with ItemComponent instead
 */
export interface ItemInstance {
  id: string;                   // Unique instance ID
  templateId: string;           // Reference to item template
  name: string;                 // Display name
  description: string;          // Description text
  category: ItemCategory;       // Item category
  character: string;            // Display character
  foreground: string;           // Foreground color
  background?: string;          // Background color
  quantity: number;             // Stack quantity
  properties: ItemProperties; // Item properties
  equipped?: boolean;           // Is equipped?
  location?: {                  // World position if on ground
    x: number;
    y: number;
    z?: number;
  };
  containerId?: number;       // Entity ID holding this item
}
