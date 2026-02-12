/**
 * Component definitions and factory functions
 */

// Base component interface
export interface Component {
  readonly type: string;
}

// Component constructor type
export type ComponentConstructor<T extends Component> = new (...args: unknown[]) => T;

// Common components
export interface PositionComponent extends Component {
  type: 'position';
  x: number;
  y: number;
  z: number;  // Layer/elevation
}

export interface VelocityComponent extends Component {
  type: 'velocity';
  vx: number;
  vy: number;
}

export interface HealthComponent extends Component {
  type: 'health';
  current: number;
  max: number;
}

export interface SpeedComponent extends Component {
  type: 'speed';
  value: number;  // 100 = normal
}

export interface ActorComponent extends Component {
  type: 'actor';
  isPlayer: boolean;
  energy: number;
  nextAction?: string;
}

export interface RenderableComponent extends Component {
  type: 'renderable';
  char: string;
  fg: string;
  bg?: string;
}

export interface TreeComponent extends Component {
  type: 'tree';
  treeType: 'oak' | 'pine' | 'birch';
  passable: boolean;
}

export interface BlockingComponent extends Component {
  type: 'blocking';
}

// Component factories
export function createPosition(x: number, y: number, z: number = 0): PositionComponent {
  return { type: 'position', x, y, z };
}

export function createVelocity(vx: number, vy: number): VelocityComponent {
  return { type: 'velocity', vx, vy };
}

export function createHealth(current: number, max: number): HealthComponent {
  return { type: 'health', current, max };
}

export function createSpeed(value: number): SpeedComponent {
  return { type: 'speed', value };
}

export function createActor(isPlayer: boolean = false): ActorComponent {
  return { type: 'actor', isPlayer, energy: 0 };
}

export function createRenderable(char: string, fg: string, bg?: string): RenderableComponent {
  return { type: 'renderable', char, fg, bg };
}

export function createTree(treeType: 'oak' | 'pine' | 'birch' = 'oak'): TreeComponent {
  return { type: 'tree', treeType, passable: false };
}

export function createBlocking(): BlockingComponent {
  return { type: 'blocking' };
}
