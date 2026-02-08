/**
 * Items module
 * Item and inventory management with ECS integration
 * 
 * This module provides items as first-class ECS entities, enabling:
 * - Items to participate in all ECS systems (physics, rendering, lighting)
 * - Runtime composition (add burning, cursed, etc. components)
 * - Unified identity space (everything is an entity)
 * - Unified serialization
 */

// Re-export all types
export * from './types';

// Re-export components
export * from './components';

// Re-export queries
export * from './queries';

// Re-export systems
export * from './systems';

// Re-export classes
export { ItemManager } from './ItemManager';
export { Inventory, InventoryComponent, createInventoryComponent } from './Inventory';
export { InventoryManager } from './InventoryManager';
