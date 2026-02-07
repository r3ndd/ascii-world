/**
 * Actor Systems for handling turn-based entity behavior
 * Following ECS paradigm - behavior is implemented in systems
 */

import { Entity, ECSWorld, System } from '../ecs';
import { PhysicsSystem } from '../physics';
import { Direction } from '../core/Types';

// Actor behavior interface
export interface ActorBehavior {
  getSpeed(entity: Entity): number;
  act(entity: Entity, physics: PhysicsSystem): Promise<void> | void;
}

// Player behavior - handles input-based actions
export class PlayerBehavior implements ActorBehavior {
  private inputHandler: (() => Promise<{ direction?: Direction; wait?: boolean }>) | null = null;

  setInputHandler(handler: () => Promise<{ direction?: Direction; wait?: boolean }>): void {
    this.inputHandler = handler;
  }

  getSpeed(entity: Entity): number {
    const speed = entity.getComponent<{ type: 'speed'; value: number }>('speed');
    return speed?.value ?? 100;
  }

  async act(entity: Entity, physics: PhysicsSystem): Promise<void> {
    if (!this.inputHandler) {
      // Default wait if no handler set
      return;
    }

    const input = await this.inputHandler();
    
    if (input.direction) {
      physics.moveEntity(entity, input.direction);
    }
    // If wait or no direction, just wait
  }
}

// NPC behavior with different AI types
export class NPCBehavior implements ActorBehavior {
  getSpeed(entity: Entity): number {
    const speed = entity.getComponent<{ type: 'speed'; value: number }>('speed');
    return speed?.value ?? 100;
  }

  act(entity: Entity, physics: PhysicsSystem): void {
    const actor = entity.getComponent<{ type: 'actor'; aiType?: string }>('actor');
    const aiType = actor?.aiType ?? 'random';

    switch (aiType) {
      case 'random':
        this.randomMovement(entity, physics);
        break;
      case 'hostile':
        // Placeholder for hostile AI
        this.randomMovement(entity, physics);
        break;
      case 'neutral':
        // Placeholder for neutral AI
        this.randomMovement(entity, physics);
        break;
      default:
        this.randomMovement(entity, physics);
    }
  }

  private randomMovement(entity: Entity, physics: PhysicsSystem): void {
    const directions: Direction[] = ['north', 'south', 'east', 'west'];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    physics.moveEntity(entity, dir);
  }
}

// Actor System - manages all actors in the game
export class ActorSystem implements System {
  readonly name = 'ActorSystem';
  readonly priority = 10;
  query = { all: ['actor', 'speed'] };

  private ecsWorld: ECSWorld;
  private physicsSystem: PhysicsSystem;
  private playerBehavior: PlayerBehavior;
  private npcBehavior: NPCBehavior;
  constructor(ecsWorld: ECSWorld, physicsSystem: PhysicsSystem) {
    this.ecsWorld = ecsWorld;
    this.physicsSystem = physicsSystem;
    this.playerBehavior = new PlayerBehavior();
    this.npcBehavior = new NPCBehavior();
  }

  setPlayerInputHandler(handler: () => Promise<{ direction?: Direction; wait?: boolean }>): void {
    this.playerBehavior.setInputHandler(handler);
  }

  getPlayerEntity(): Entity | undefined {
    const actors = this.ecsWorld.queryEntities({ all: ['actor'] });
    return actors.find(entity => {
      const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
      return actor?.isPlayer ?? false;
    });
  }

  getAllActors(): Entity[] {
    return this.ecsWorld.queryEntities({ all: ['actor', 'speed'] });
  }

  getSpeed(entity: Entity): number {
    const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
    if (actor?.isPlayer) {
      return this.playerBehavior.getSpeed(entity);
    }
    return this.npcBehavior.getSpeed(entity);
  }

  async act(entity: Entity): Promise<void> {
    const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
    if (actor?.isPlayer) {
      await this.playerBehavior.act(entity, this.physicsSystem);
    } else {
      await this.npcBehavior.act(entity, this.physicsSystem);
    }
  }

  update(): void {
    // Update is called by ECS world, but turn-based acting is handled by TurnManager
  }

  onEntityAdded(): void {
    // Entity added - could initialize actor state here
  }

  onEntityRemoved(): void {
    // Entity removed - could cleanup actor state here
  }
}

export { ActorSystem as default };
