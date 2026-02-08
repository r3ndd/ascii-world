/**
 * Item ECS Queries
 * Predefined query patterns for item entities
 */

import { Query } from '../ecs';

/**
 * All items in the game world
 */
export const ITEMS_QUERY: Query = {
  all: ['item']
};

/**
 * Items currently equipped by entities
 */
export const EQUIPPED_ITEMS_QUERY: Query = {
  all: ['item'],
  any: ['equipped']
};

/**
 * Items lying on the ground (have position)
 */
export const WORLD_ITEMS_QUERY: Query = {
  all: ['item', 'position']
};

/**
 * Items in inventories (no position component)
 * Note: Items in inventories have been stripped of position/renderable
 */
export const INVENTORY_ITEMS_QUERY: Query = {
  all: ['item'],
  none: ['position']
};

/**
 * Stackable items in the world
 */
export const STACKABLE_WORLD_ITEMS_QUERY: Query = {
  all: ['item', 'position']
};

/**
 * Items of a specific category
 * Use with additional filtering in system
 */
export const ITEMS_BY_CATEGORY_QUERY: Query = {
  all: ['item', 'item_template']
};

/**
 * Items at a specific position
 * Use with custom position filtering
 */
export function createPositionQuery(_x: number, _y: number, _z: number = 0): Query {
  return {
    all: ['item', 'position']
  };
}

/**
 * Query builder for items by template ID
 */
export function createTemplateQuery(_templateId: string): Query {
  return {
    all: ['item']
  };
}
