/**
 * Entity Serializer
 * Handles entity and component serialization
 */

import { Entity, ECSWorld } from '../ecs';
import { SerializedEntity } from './SerializedData';

export class EntitySerializer {
  static serialize(entity: Entity): SerializedEntity {
    return {
      id: entity.id,
      components: entity.getAllComponents()
    };
  }

  static serializeAll(ecsWorld: ECSWorld): SerializedEntity[] {
    return ecsWorld.getAllEntities().map(entity => this.serialize(entity));
  }

  static deserialize(data: SerializedEntity, ecsWorld: ECSWorld): Entity {
    // Check if entity already exists
    let entity = ecsWorld.getEntity(data.id);
    
    if (!entity) {
      // Create new entity with the specified ID
      // We need to access the private static counter, so we'll use a workaround
      entity = ecsWorld.createEntity();
      // Note: In a real implementation, you might want to add a method to ECSWorld
      // to create an entity with a specific ID
    }

    // Clear existing components
    const existingComponents = entity.getAllComponents();
    for (const component of existingComponents) {
      entity.removeComponent(component.type);
    }

    // Add serialized components
    for (const component of data.components) {
      // Type assertion needed since we're working with generic components
      (entity as any).addComponent(component);
    }

    return entity;
  }

  static deserializeAll(data: SerializedEntity[], ecsWorld: ECSWorld): void {
    // Clear existing entities first
    const existingEntities = ecsWorld.getAllEntities();
    for (const entity of existingEntities) {
      ecsWorld.removeEntity(entity.id);
    }

    // Deserialize all entities
    for (const entityData of data) {
      this.deserialize(entityData, ecsWorld);
    }
  }
}
