/**
 * Item ECS Components
 * Defines component interfaces for items as ECS entities
 */

import { Component } from '../ecs';

// Types are used in factory functions via parameters

/**
 * Item component - runtime state for an item entity
 */
export interface ItemComponent extends Component {
  type: 'item';
  templateId: string;           // Reference to content pack template
  quantity: number;             // Current stack quantity
  durability?: number;          // Current durability (optional)
  maxDurability?: number;       // Maximum durability
  quality?: number;             // Quality level (1-100)
  stackable: boolean;           // Can this item stack?
  maxStack: number;             // Maximum stack size
  value: number;                // Base value/cost
  equipped: boolean;            // Is item currently equipped?
  equippedSlot?: string;        // Which slot: 'hand', 'body', 'head', etc.
}

/**
 * Item template component - static properties from content definition
 * Duplicated here for quick access without template lookup
 */
export interface ItemTemplateComponent extends Component {
  type: 'item_template';
  name: string;                 // Display name
  description: string;          // Description text
  category: string;             // ItemCategory as string
  weight: number;             // Weight in kg
  volume: number;             // Volume in liters
  tags: string[];             // Item tags for categorization
  character: string;            // Display character
  foreground: string;         // Foreground color
  background?: string;        // Background color (optional)
}

/**
 * Component factory for items
 */
export function createItemComponent(
  templateId: string,
  quantity: number,
  options: {
    durability?: number;
    maxDurability?: number;
    quality?: number;
    stackable?: boolean;
    maxStack?: number;
    value?: number;
    equipped?: boolean;
    equippedSlot?: string;
  } = {}
): ItemComponent {
  return {
    type: 'item',
    templateId,
    quantity,
    durability: options.durability,
    maxDurability: options.maxDurability,
    quality: options.quality ?? 50,
    stackable: options.stackable ?? false,
    maxStack: options.maxStack ?? 1,
    value: options.value ?? 0,
    equipped: options.equipped ?? false,
    equippedSlot: options.equippedSlot
  };
}

/**
 * Component factory for item templates
 */
export function createItemTemplateComponent(
  name: string,
  description: string,
  category: string,
  weight: number,
  volume: number,
  character: string,
  foreground: string,
  options: {
    tags?: string[];
    background?: string;
  } = {}
): ItemTemplateComponent {
  return {
    type: 'item_template',
    name,
    description,
    category,
    weight,
    volume,
    character,
    foreground,
    background: options.background,
    tags: options.tags ?? []
  };
}
