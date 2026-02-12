/**
 * Entity - Container for components
 */

import { EntityId } from '../core/Types';
import { Component } from './Component';

export class Entity {
  private static nextId: number = 1;
  readonly id: EntityId;
  private components: Map<string, Component> = new Map();

  constructor() {
    this.id = Entity.nextId++;
  }

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  removeComponent(componentType: string): boolean {
    return this.components.delete(componentType);
  }

  getComponent<T extends Component>(componentType: string): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  hasComponent(componentType: string): boolean {
    return this.components.has(componentType);
  }

  hasComponents(...componentTypes: string[]): boolean {
    return componentTypes.every(type => this.components.has(type));
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }
}
