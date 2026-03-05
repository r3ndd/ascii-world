# ASCII World - API Documentation

A comprehensive reference of all classes, interfaces, types, functions, and their members.

## Table of Contents

- [Core](#core)
- [ECS (Entity Component System)](#ecs-entity-component-system)
- [World Management](#world-management)
- [Display System](#display-system)
- [Time/Turn System](#timeturn-system)
- [Physics System](#physics-system)
- [AI System](#ai-system)
- [Items & Inventory](#items--inventory)
- [Crafting System](#crafting-system)
- [Save System](#save-system)
- [Content System](#content-system)

---

## Core

### `Engine` (Class)
Main game engine that orchestrates all systems.

**Properties:**
- `eventBus: EventBus`
- `config: Config`
- `isRunning: boolean`
- `displayManager: DisplayManager`
- `camera: Camera`
- `renderer: Renderer`
- `ecsWorld: ECSWorld`
- `mapManager: MapManager`
- `physicsSystem: PhysicsSystem`
- `fovSystem: FOVSystem`
- `pathfinding: Pathfinding`
- `actorSystem: ActorSystem`
- `itemManager: ItemManager`
- `inventoryManager: InventoryManager`
- `lookMode: LookMode`
- `lookPanel: LookPanel`
- `crosshairRenderer: CrosshairRenderer`
- `inventoryPanel: InventoryPanel`
- `isInLookMode: boolean`
- `inputPaused: boolean`
- `engineConfig: EngineConfig`
- `playerEntity: Entity`

**Methods:**
- `constructor(container: HTMLElement, config?: Partial<EngineConfig>)`
- `initialize(config?: EngineConfig): Promise<void>`
- `createPlayer(x: number, y: number, z: number): Entity`
- `createNPC(x: number, y: number, z: number, name: string, char: string): Entity`
- `setUIConfig(config: UIConfig): void`
- `enterLookMode(): void`
- `exitLookMode(): void`
- `handleLookModeInput(key: string): void`
- `executeLookAction(): boolean`
- `executeLookActionByHotkey(): boolean`
- `render(): void`
- `renderUI(): void`
- `getContainer(): HTMLElement`
- `getPlayerEntity(): Entity | null`
- `running(): boolean`
- `pauseInput(): void`
- `resumeInput(): void`

---

### `Config` (Class)
Singleton configuration manager.

**Properties:**
- `static instance: Config`
- `_config: GameConfig`

**Methods:**
- `constructor()`
- `static getInstance(): Config`
- `get world(): WorldConfig`
- `get actions(): ActionConfig`
- `get debug(): DebugConfig`
- `set debug(value: DebugConfig)`

---

### `EventBus` (Class)
Event publishing and subscription system.

**Properties:**
- `handlers: Map<string, EventHandler[]>`

**Methods:**
- `on(event: string, handler: EventHandler): () => void`
- `off(event: string, handler: EventHandler): void`
- `emit(event: string, data?: any): void`
- `clear(): void`

**Types:**
- `EventHandler: (data?: any) => void`
- `globalEventBus: EventBus`

---

### `Types.ts`

**Type Aliases:**
- `EntityId: number`
- `Direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest'`

**Interfaces:**

```typescript
interface Position {
  x: number;
  y: number;
  z: number;
}

interface Size {
  width: number;
  height: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ChunkCoord {
  chunkX: number;
  chunkY: number;
}
```

---

## ECS (Entity Component System)

### `Entity` (Class)
Individual game object container.

**Static Properties:**
- `nextId: number`

**Properties:**
- `id: EntityId`
- `components: Map<string, Component>`

**Methods:**
- `constructor()`
- `addComponent(component: Component): void`
- `removeComponent(type: string): void`
- `getComponent<T extends Component>(type: string): T | undefined`
- `hasComponent(type: string): boolean`
- `hasComponents(types: string[]): boolean`
- `getAllComponents(): Component[]`

---

### `ECSWorld` (Class)
ECS world manager for entities and systems.

**Properties:**
- `entities: Map<EntityId, Entity>`
- `systems: System[]`
- `eventBus: EventBus`
- `entityQueryCache: Map<string, Entity[]>`
- `isRunning: boolean`
- `lastUpdateTime: number`

**Methods:**
- `constructor(eventBus?: EventBus)`
- `createEntity(): Entity`
- `removeEntity(entityId: EntityId): boolean`
- `getEntity(entityId: EntityId): Entity | undefined`
- `getAllEntities(): Entity[]`
- `getEntitiesAtPosition(x: number, y: number, z: number): Entity[]`
- `queryEntities(query: Query): Entity[]`
- `addSystem(system: System): void`
- `removeSystem(systemName: string): boolean`
- `update(deltaTime: number): void`
- `start(): void`
- `stop(): void`
- `clear(): void`
- `matchesQuery(entity: Entity, query: Query): boolean`
- `queryToCacheKey(query: Query): string`
- `invalidateCache(): void`

---

### `Component` (Interface)
Base component interface.

```typescript
interface Component {
  type: string;
}
```

**Component Types:**

| Component | Properties |
|-----------|------------|
| `PositionComponent` | `type: 'position'`, `x: number`, `y: number`, `z: number` |
| `VelocityComponent` | `type: 'velocity'`, `vx: number`, `vy: number` |
| `HealthComponent` | `type: 'health'`, `current: number`, `max: number` |
| `SpeedComponent` | `type: 'speed'`, `value: number` |
| `RenderableComponent` | `type: 'renderable'`, `char: string`, `fg: string`, `bg: string` |
| `ActorComponent` | `type: 'actor'`, `isPlayer: boolean`, `energy: number`, `nextAction: ActionType` |
| `TreeComponent` | `type: 'tree'`, `treeType: string`, `passable: boolean` |
| `BlockingComponent` | `type: 'blocking'` |
| `DescriptionComponent` | `type: 'description'`, `text: string`, `dynamic?: boolean` |
| `AIComponent` | `type: 'ai'`, `behaviorType: string`, `memorySystemId: string` |
| `PatrolComponent` | `type: 'patrol'`, `waypoints: Position[]`, `currentIndex: number`, `direction: number`, `isLoop: boolean` |
| `DetectionComponent` | `type: 'detection'`, `visionRange: number`, `hearingRange: number`, `lastScanTurn: number` |
| `CombatComponent` | `type: 'combat'`, `targetId: EntityId`, `attackCooldown: number`, `preferredRange: number`, `aggression: number` |

**Factory Functions:**
- `createPosition(x, y, z)`
- `createVelocity(vx, vy)`
- `createHealth(current, max)`
- `createSpeed(value)`
- `createActor(isPlayer, energy, nextAction?)`
- `createRenderable(char, fg, bg)`
- `createTree(treeType, passable?)`
- `createBlocking()`
- `createDescription(text, dynamic?)`
- `createAI(behaviorType, memorySystemId?)`
- `createPatrol(waypoints, isLoop?)`
- `createDetection(visionRange, hearingRange)`
- `createCombat(targetId?, attackCooldown?, preferredRange?, aggression?)`

---

### `System` (Interface)
Base system interface.

```typescript
interface System {
  name: string;
  priority: number;
  query: Query;
  update(entities: Entity[], deltaTime: number): void;
  onEntityAdded?(entity: Entity): void;
  onEntityRemoved?(entity: Entity): void;
}
```

### `BaseSystem` (Class)
Abstract base system implementation.

**Properties:**
- `name: string`
- `priority: number`
- `query: Query`

**Methods:**
- `update(entities: Entity[], deltaTime: number): void`
- `onEntityAdded(entity: Entity): void`
- `onEntityRemoved(entity: Entity): void`

---

### `Query` (Interface)
Entity query specification.

```typescript
interface Query {
  all: string[];   // Must have all these components
  any: string[];   // Must have at least one
  none: string[];  // Must have none
}
```

---

### `EntityFactory` (Class)
Factory for creating common entity types.

**Methods:**
- `createPlayer(options: PlayerOptions): Entity`
- `createNPC(options: NPCOptions): Entity`
- `createTree(options: TreeOptions): Entity`

**Interfaces:**

```typescript
interface PlayerOptions {
  position: { x, y, z };
  char: string;
  fg: string;
  bg?: string;
  maxHealth: number;
  speed: number;
  name: string;
  description: string;
}

interface NPCOptions {
  position: { x, y, z };
  char: string;
  fg: string;
  bg?: string;
  maxHealth: number;
  speed: number;
  name: string;
  aiType: string;
  description: string;
}

interface TreeOptions {
  position: { x, y, z };
  treeType: string;
  description: string;
}
```

---

## World Management

### `World` (Class)
Primary world container managing layers and chunks.

**Properties:**
- `chunkManagers: Map<number, ChunkManager>`
- `layers: Map<number, WorldLayer>`
- `chunkSize: number`
- `defaultLayer: number`
- `ecsWorld: ECSWorld`
- `updateScheduler: UpdateScheduler`

**Methods:**
- `constructor(ecsWorld: ECSWorld, chunkSize?: number)`
- `addLayer(layerId: number, config: LayerConfig): void`
- `removeLayer(layerId: number): boolean`
- `hasLayer(layerId: number): boolean`
- `getChunkManager(layerId: number): ChunkManager | undefined`
- `getTileAt(x, y, z): Tile | undefined`
- `setTileAt(x, y, z, tile): void`
- `getEntitiesAt(x, y, z): Entity[]`
- `isValidPosition(x, y, z): boolean`
- `initialize(generator: WorldGenerator): void`
- `configureGenerator(generator: WorldGenerator): void`
- `getWidth(z): number`
- `getHeight(z): number`
- `getLayers(): number[]`
- `getECSWorld(): ECSWorld`
- `getUpdateScheduler(): UpdateScheduler`
- `setPlayerPosition(entity: Entity): void`
- `update(deltaTime): void`
- `clearChunks(): void`

---

### `Chunk` (Class)
Individual world chunk containing tiles and entities.

**Properties:**
- `chunkX: number`
- `chunkY: number`
- `size: number`
- `tiles: Tile[][]`
- `entities: Set<EntityId>`
- `lastUpdateTurn: number`
- `needsCatchUp: boolean`

**Methods:**
- `constructor(chunkX, chunkY, size)`
- `getTile(localX, localY): Tile | undefined`
- `setTile(localX, localY, tile): void`
- `addEntity(entityId): void`
- `removeEntity(entityId): boolean`
- `getAllEntities(): EntityId[]`
- `getEntityPosition(entityId): {x, y} | undefined`
- `getLastUpdateTurn(): number`
- `markUpdated(turn): void`
- `isCatchUpNeeded(): boolean`
- `setCatchUpNeeded(needed): void`
- `fill(tile): void`
- `toLocalPosition(worldX, worldY): {x, y}`
- `toWorldPosition(localX, localY): {x, y}`
- `isValidLocalPosition(x, y): boolean`

---

### `ChunkManager` (Class)
Manages chunk lifecycle and activation.

**Properties:**
- `chunks: Map<string, Chunk>`
- `activeChunks: Set<string>`
- `chunkSize: number`
- `playerChunkX: number`
- `playerChunkY: number`
- `updateScheduler: UpdateScheduler`
- `ecsWorld: ECSWorld`
- `terrainGenerator: ChunkGenerator | null`
- `generatorContext: GeneratorContext`

**Methods:**
- `constructor(ecsWorld, chunkSize, updateScheduler)`
- `getChunk(chunkX, chunkY): Chunk | undefined`
- `getOrCreateChunk(chunkX, chunkY): Chunk`
- `activateChunk(chunkX, chunkY): void`
- `deactivateDistantChunks(playerX, playerY, radius): void`
- `activateNearbyChunks(playerX, playerY, radius): void`
- `getActiveChunks(): Chunk[]`
- `generateTerrain(chunk): void`
- `setTerrainGenerator(generator): void`
- `getTileAt(x, y): Tile | undefined`
- `setTileAt(x, y, tile): void`
- `isValidPosition(x, y): boolean`
- `worldToChunk(worldX, worldY): {chunkX, chunkY}`
- `getChunkKey(chunkX, chunkY): string`
- `processChunkUpdate(chunk, currentTurn): void`
- `processCatchUp(chunk, turnsElapsed): void`
- `setPlayerPosition(x, y): void`
- `update(currentTurn): void`
- `clearChunks(): void`

---

### `MapManager` (Class)
Manages multiple world maps.

**Properties:**
- `maps: Map<string, World>`
- `currentMap: World | null`
- `ecsWorld: ECSWorld`
- `worldGenerator: WorldGenerator`

**Methods:**
- `constructor(ecsWorld, worldGenerator)`
- `registerMap(id: string, world: World): void`
- `getMap(id: string): World | undefined`
- `loadMap(id: string): boolean`
- `getCurrentMap(): World | null`
- `getAllMaps(): World[]`
- `createDefaultWorld(): World`

**Interface:**
```typescript
interface WorldGeneratorConfig {
  generatorName: string;
  params: Record<string, any>;
}
```

---

### `WorldConfig.ts`

**Type:**
- `TerrainType: 'floor' | 'wall' | 'water' | 'tree' | 'door' | 'stairs_up' | 'stairs_down'`

**Interface:**
```typescript
interface Tile {
  terrain: TerrainType;
  blocksMovement: boolean;
  blocksLight: boolean;
  char: string;
  fg: string;
  bg: string;
  transparent: boolean;
}

interface LayerConfig {
  width: number;
  height: number;
}
```

**Constant:**
```typescript
TERRAIN = {
  floor: { /* ... */ },
  wall: { /* ... */ },
  water: { /* ... */ },
  tree: { /* ... */ },
  door: { /* ... */ },
  stairs_up: { /* ... */ },
  stairs_down: { /* ... */ }
}
```

---

### `UpdateScheduler` (Class)
Determines which chunks need updates based on distance.

**Properties:**
- `courseSchedule: number[]`
- `fullUpdateDistance: number`
- `currentTurn: number`
- `lastUpdates: Map<string, number>`

**Methods:**
- `constructor()`
- `getCurrentTurn(): number`
- `advanceTurn(): number`
- `shouldUpdate(chunkX, chunkY, playerX, playerY): boolean`
- `markUpdated(chunkX, chunkY): void`
- `getDistanceFromPlayer(chunkX, chunkY, playerX, playerY): number`
- `getTurnsSinceLastUpdate(chunkX, chunkY): number`
- `getChunkKey(x, y): string`

---

### `MapMetadata` (Interface)
```typescript
interface MapMetadata {
  id: string;
  name: string;
  description: string;
  size: { width: number; height: number };
  thumbnail?: string;
}
```

---

## Display System

### `DisplayManager` (Class)
Rot.js display wrapper.

**Interface:**
```typescript
interface DisplayConfig {
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fg: string;
  bg: string;
  spacing: number;
  forceSquareRatio: boolean;
}
```

**Properties:**
- `display: Display`
- `config: DisplayConfig`

**Methods:**
- `constructor(config: Partial<DisplayConfig>)`
- `getDisplay(): Display`
- `getContainer(): HTMLElement`
- `getSize(): { w, h }`
- `computeSize(availWidth, availHeight): { w, h }`
- `draw(x, y, char, fg?, bg?): void`
- `drawText(x, y, text, maxWidth?): number`
- `clear(): void`
- `eventToPosition(e): { x, y }`

---

### `Renderer` (Class)
Main rendering coordinator.

**Interface:**
```typescript
interface Renderable {
  getChar(): string;
  getForeground(): string;
  getBackground(): string;
  getPosition(): Position;
  isVisible(): boolean;
}
```

**Properties:**
- `displayManager: DisplayManager`
- `camera: Camera`
- `ecsWorld: ECSWorld`
- `fovSystem: FOVSystem | null`

**Methods:**
- `constructor(displayManager, camera, ecsWorld)`
- `getDisplayManager(): DisplayManager`
- `getCamera(): Camera`
- `getECSWorld(): ECSWorld`
- `setFOVSystem(fovSystem): void`
- `render(): void`
- `renderText(x, y, text, options?): void`

---

### `Camera` (Class)
Viewport management and coordinate transformation.

**Properties:**
- `position: Position`
- `viewportSize: Size`
- `worldBounds: Bounds`

**Methods:**
- `constructor(viewportSize, worldBounds)`
- `setPosition(x, y, z): void`
- `getPosition(): Position`
- `getViewportSize(): Size`
- `worldToScreen(worldX, worldY): {x, y} | null`
- `screenToWorld(screenX, screenY): {x, y} | null`
- `isInViewport(worldX, worldY): boolean`

---

## Time/Turn System

### `TurnManager` (Class)
Turn scheduling and coordination.

**Properties:**
- `eventBus: EventBus`
- `currentTurn: number`
- `isRunning: boolean`
- `scheduler: Scheduler`
- `actorSystem: ActorSystem`
- `actorWrappers: Map<EntityId, ActorWrapper>`
- `playerEntityId: EntityId | null`

**Methods:**
- `constructor(eventBus, actorSystem)`
- `start(): void`
- `stop(): void`
- `pause(): void`
- `resume(): void`
- `processNextTurn(): boolean`
- `processSingleTurn(): boolean`
- `getCurrentTurn(): number`
- `setPlayerInputHandler(handler): void`
- `registerActorEntity(entity): void`
- `isPlayerTurn(): boolean`
- `getPlayerEntity(): Entity | null`
- `scanForActors(): void`
- `scanForNewActors(): void`
- `handleEntityCreated(entity): void`
- `handleEntityRemoved(entity): void`

---

### `ActorSystem` (Class)
Manages actor entities and their behaviors.

**Interface:**
```typescript
interface ActorBehavior {
  getSpeed(): number;
  act(): Promise<ActionType> | ActionType;
}
```

**Properties:**
- `name = 'actor'`
- `priority = 100`
- `query: Query`
- `ecsWorld: ECSWorld`
- `physicsSystem: PhysicsSystem`
- `playerBehavior: PlayerBehavior`
- `npcBehavior: NPCBehavior`

**Methods:**
- `constructor(ecsWorld, physicsSystem, eventBus)`
- `setPlayerInputHandler(handler): void`
- `update(entities, deltaTime): void`
- `onEntityAdded(entity): void`
- `onEntityRemoved(entity): void`
- `getAllActors(): Entity[]`
- `getPlayerEntity(): Entity | null`
- `getSpeed(entity): number`
- `act(entity): Promise<ActionType>`

**Nested Classes:**
- `PlayerBehavior` - `setInputHandler()`, `getSpeed()`, `act()`
- `NPCBehavior` - `getSpeed()`, `act()`, `randomMovement()`

---

### `SpeedSystem` (Class)
Calculates action costs based on speed.

**Properties:**
- `baseSpeed: number`

**Methods:**
- `constructor(baseSpeed = 100)`
- `getBaseSpeed(): number`
- `calculateActionCost(actionType, speed): number`
- `getActionTicks(actionCost, speed): number`

---

### `Action.ts`

**Interface:**
```typescript
interface Actor {
  entityId: EntityId;
  getSpeed(): number;
  act(): Promise<ActionType>;
}

interface ActionCost {
  baseCost: number;
  speedFactor: number;
}
```

**Enum:**
```typescript
enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  CRAFT = 'craft',
  WAIT = 'wait',
  INTERACT = 'interact',
  PICKUP = 'pickup',
  DROP = 'drop',
  ASCEND = 'ascend',
  DESCEND = 'descend'
}
```

**Class `Action`:**
- `type: ActionType`
- `cost: ActionCost`
- `data?: any`
- Constructor methods:
  - `createMoveAction(direction)`
  - `createAttackAction(targetId)`
  - `createWaitAction()`
  - `createCraftAction(recipeId)`
  - `createInteractAction(targetId)`
  - `createPickupAction(itemId)`
  - `createDropAction(itemId)`
  - `createAscendAction()`
  - `createDescendAction()`

---

## Physics System

### `PhysicsSystem` (Class)
Movement and collision handling.

**Constant:**
```typescript
DIRECTION_OFFSETS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northeast: { dx: 1, dy: -1 },
  northwest: { dx: -1, dy: -1 },
  southeast: { dx: 1, dy: 1 },
  southwest: { dx: -1, dy: 1 }
}
```

**Properties:**
- `ecsWorld: ECSWorld`
- `eventBus: EventBus`

**Methods:**
- `constructor(ecsWorld, eventBus)`
- `moveEntity(entityId, direction): boolean`
- `canMoveTo(x, y, z, movingEntityId?): boolean`
- `entityBlocksMovement(entity): boolean`
- `getEntityPosition(entity): Position | null`
- `ascend(entity): boolean`
- `descend(entity): boolean`

---

### `FOVSystem` (Class)
Field of view computation.

**Properties:**
- `world: World`
- `visibleTiles: Set<string>`
- `exploredTiles: Set<string>`

**Methods:**
- `constructor(world)`
- `computeFOV(x, y, z, radius): void`
- `getVisibleTiles(): Position[]`
- `isVisible(x, y, z): boolean`
- `isExplored(x, y, z): boolean`
- `reset(): void`
- `getTileKey(x, y, z): string`

---

### `Pathfinding` (Class)
Path computation using A* and Dijkstra.

**Properties:**
- `world: World`

**Methods:**
- `constructor(world)`
- `findPath(start, end, z): Position[] | null`
- `findPathDijkstra(start, maxDistance, z): Map<string, number>`

---

## AI System

### `AISystem` (Class)
AI behavior management and processing.

**Properties:**
- `name = 'ai'`
- `priority = 50`
- `query: Query`
- `ecsWorld: ECSWorld`
- `physicsSystem: PhysicsSystem`
- `pathfinding: Pathfinding`
- `eventBus: EventBus`
- `memoryManager: MemorySystem`
- `behaviorRegistry: Map<string, BehaviorTreeFactory>`
- `globalTurn: number`

**Methods:**
- `constructor(ecsWorld, physicsSystem, eventBus)`
- `update(entities, deltaTime): void`
- `onEntityAdded(entity): void`
- `onEntityRemoved(entity): void`
- `registerBehavior(name, factory): void`
- `getBehavior(name): BehaviorTreeFactory | undefined`
- `assignBehavior(entity, behaviorType): void`
- `setBehaviorTree(entity, tree): void`
- `getPathfinding(): Pathfinding`
- `getMemorySystem(entityId): MemorySystem | undefined`
- `rememberEntity(observerId, targetId, info): void`
- `setGlobalTurn(turn): void`
- `processMemoryDecay(): void`
- `clear(): void`

**Types:**
- `BehaviorTreeFactory: (entity: Entity, aiSystem: AISystem) => BehaviorTree`
- `BehaviorPreset = 'wander' | 'hunter' | 'patrol' | 'coward' | 'neutral'`

**Constant:**
```typescript
BehaviorPresets = {
  WANDER: 'wander',
  HUNTER: 'hunter',
  PATROL: 'patrol',
  COWARD: 'coward',
  NEUTRAL: 'neutral'
}
```

---

### `AIBehaviors.ts`

**Behavior Tree Nodes:**

| Node | Type | Description |
|------|------|-------------|
| `MoveRandom` | Action | Random direction movement |
| `MoveToTarget` | Action | Move toward target position |
| `MoveAway` | Action | Flee from threat |
| `AttackTarget` | Action | Attack if in range |
| `CanAttackTarget` | Condition | Check if attack possible |
| `IsHealthLow` | Condition | Check health threshold |
| `HasTarget` | Condition | Verify target exists |
| `IsAtTarget` | Condition | Check at destination |
| `ClearPath` | Action | Reset pathfinding |
| `ClearTarget` | Action | Clear current target |
| `CanSeeHostile` | Condition | Visibility check |

**Blackboard Keys:**
```typescript
BBKeys = {
  TARGET_ENTITY: 'targetEntity',
  TARGET_POSITION: 'targetPosition',
  LAST_KNOWN_TARGET_POS: 'lastKnownTargetPos',
  IN_COMBAT: 'inCombat',
  SHOULD_FLEE: 'shouldFlee',
  ATTACK_COOLDOWN: 'attackCooldown',
  CURRENT_PATH: 'currentPath',
  PATH_INDEX: 'pathIndex',
  WANDER_TARGET: 'wanderTarget',
  STUCK_COUNTER: 'stuckCounter',
  MEMORY_SYSTEM: 'memorySystem',
  NEARBY_ENTITIES: 'nearbyEntities',
  VISIBLE_THREATS: 'visibleThreats',
  VISIBLE_ALLIES: 'visibleAllies',
  PATROL_POINTS: 'patrolPoints',
  PATROL_INDEX: 'patrolIndex',
  PATROL_DIRECTION: 'patrolDirection'
}
```

---

### `BehaviorTree.ts`

**Base Classes:**
- `BehaviorNode` - Base node class
- `BehaviorTree` - Tree container
- `Sequence` - Execute children in order until failure
- `Selector` - Execute children until success
- `Parallel` - Execute all children
- `Inverter` - Invert child result
- `Succeeder` - Always succeed
- `Repeater` - Repeat child N times or forever
- `RepeatUntilFail` - Repeat until failure

**Status Enum:**
```typescript
enum NodeStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  RUNNING = 'running'
}
```

---

### `MemorySystem.ts`

**Interface:**
```typescript
interface EntityMemory {
  entityId: EntityId;
  position: Position;
  type: string;
  lastSeen: number;
  threat: number;
  friendliness: number;
}

interface AISnapshot {
  turn: number;
  position: Position;
  health: number;
  action: string;
}
```

**Class `MemorySystem`:**
- `remember(entityId, info): void`
- `recall(entityId): EntityMemory | undefined`
- `forget(entityId): void`
- `getRecent(threshold): EntityMemory[]`
- `getThreats(): EntityMemory[]`
- `getAllies(): EntityMemory[]`
- `decay(turnsElapsed): void`
- `getSnapshot(): AISnapshot`
- `restore(snapshot): void`

---

## Items & Inventory

### `Inventory` (Class)
Inventory management for entities.

**Interface:**
```typescript
interface InventoryComponent extends Component {
  type: 'inventory';
  capacity: number;
  volumeCapacity: number;
  itemIds: EntityId[];
}
```

**Properties:**
- `ownerId: EntityId`
- `itemIds: EntityId[]`
- `capacity: number`
- `volumeCapacity: number`
- `eventBus: EventBus`

**Methods:**
- `constructor(ownerId, capacity, volumeCapacity, eventBus)`
- `addItem(itemId): boolean`
- `removeItem(itemId): boolean`
- `hasItem(itemId): boolean`
- `getItems(): EntityId[]`
- `getItemCount(): number`
- `canAddItem(item): boolean`
- `canAddWeight(weight): boolean`
- `getCurrentWeight(): number`
- `getCurrentVolume(): number`
- `remainingWeight(): number`
- `remainingVolume(): number`
- `transferItem(itemId, targetInventory): boolean`
- `equipItem(itemId): boolean`
- `unequipItem(itemId): boolean`
- `getEquippedItems(): EntityId[]`
- `dropItem(itemId): boolean`
- `findStackableItem(item): EntityId | undefined`
- `getItemsByCategory(category): EntityId[]`
- `getTotalValue(): number`
- `weightCapacity(): number`
- `volCapacity(): number`
- `owner(): EntityId`
- `clear(): void`
- `toJSON(): object`
- `fromJSON(data): Inventory`

---

### `ItemManager` (Class)
Item template and instance management.

**Properties:**
- `templates: Map<string, ItemTemplate>`
- `eventBus: EventBus`

**Methods:**
- `constructor(eventBus)`
- `registerTemplate(template): void`
- `getTemplate(id): ItemTemplate | undefined`
- `getAllTemplates(): ItemTemplate[]`
- `getTemplatesByCategory(category): ItemTemplate[]`
- `spawnItem(templateId, position): Entity | null`
- `getItem(itemId): Item | undefined`
- `getItemsAt(x, y, z): Entity[]`
- `getItemsByContainer(containerId): Entity[]`
- `removeItem(itemId): boolean`
- `registerDefaultTemplates(): void`
- `serializeTemplates(): string`
- `clear(): void`

---

### `InventoryManager` (Class)
Manages all inventories in the world.

**Properties:**
- `inventories: Map<EntityId, Inventory>`
- `eventBus: EventBus`

**Methods:**
- `constructor(eventBus)`
- `createInventory(entityId, capacity, volumeCapacity): Inventory`
- `getInventory(entityId): Inventory | undefined`
- `hasInventory(entityId): boolean`
- `removeInventory(entityId): boolean`
- `transferItem(fromId, toId, itemId): boolean`
- `getAllInventories(): Inventory[]`
- `serializeInventories(): string`
- `deserializeInventories(data): void`
- `clear(): void`

---

### `types.ts`

**Interfaces:**
```typescript
interface Item {
  id: EntityId;
  templateId: string;
  name: string;
  description: string;
  char: string;
  fg: string;
  bg: string;
  weight: number;
  volume: number;
  category: ItemCategory;
  tags: string[];
  stackable: boolean;
  maxStack: number;
  quantity: number;
  value: number;
  effects: Effect[];
  durability?: number;
  maxDurability?: number;
  equipped: boolean;
  slot?: EquipmentSlot;
  containerId?: EntityId;
}

interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  char: string;
  fg: string;
  bg: string;
  weight: number;
  volume: number;
  category: ItemCategory;
  tags: string[];
  stackable: boolean;
  maxStack: number;
  value: number;
  effects: Effect[];
  durability?: number;
  maxDurability?: number;
}

type ItemCategory = 
  | 'weapon' 
  | 'armor' 
  | 'consumable' 
  | 'material' 
  | 'tool' 
  | 'misc';

type EquipmentSlot = 
  | 'head' 
  | 'body' 
  | 'hands' 
  | 'feet' 
  | 'mainHand' 
  | 'offHand' 
  | 'accessory';
```

---

### `components.ts`

**Component Factories:**
- `createItemComponent(template): ItemComponent`
- `createStackableComponent(maxStack): StackableComponent`
- `createEquipableComponent(slot): EquipableComponent`
- `createConsumableComponent(effect): ConsumableComponent`
- `createWeaponComponent(damage, range): WeaponComponent`
- `createArmorComponent(defense): ArmorComponent`

---

## Crafting System

### `CraftingSystem` (Class)
Crafting and recipe management.

**Methods:**
- `registerRecipe(recipe): void`
- `getRecipe(id): Recipe | undefined`
- `getAllRecipes(): Recipe[]`
- `getAvailableRecipes(inventory): Recipe[]`
- `canCraft(recipe, inventory): boolean`
- `craft(recipe, inventory): Entity | null`
- `getIngredients(recipe): Ingredient[]`
- `getProducts(recipe): Product[]`

---

### `Recipe` (Class)
Individual crafting recipe.

**Properties:**
- `id: string`
- `name: string`
- `category: string`
- `ingredients: Ingredient[]`
- `products: Product[]`
- `timeCost: number`
- `skillRequirements: SkillRequirement[]`
- `toolRequirements: string[]`

**Types:**
```typescript
interface Ingredient {
  itemId: string;
  quantity: number;
  consume: boolean;
}

interface Product {
  itemId: string;
  quantity: number;
  chance: number;
}

interface SkillRequirement {
  skill: string;
  level: number;
}
```

---

### `ConstructionSystem` (Class)
Building and construction management.

**Methods:**
- `registerBlueprint(blueprint): void`
- `getBlueprint(id): Blueprint | undefined`
- `getAvailableBlueprints(inventory): Blueprint[]`
- `canBuild(blueprint, position, inventory): boolean`
- `build(blueprint, position, inventory): boolean`
- `demolish(x, y, z): boolean`

---

## Save System

### `SaveManager` (Class)
Game save/load management.

**Properties:**
- `storage: StorageProvider`
- `eventBus: EventBus`
- `version: string`
- `playTimeStart: number`
- `totalPlayTime: number`

**Methods:**
- `constructor(storage, eventBus, version?)`
- `createSave(name): SaveMetadata`
- `loadSave(id): SaveData | null`
- `quickSave(): SaveMetadata`
- `quickLoad(): SaveData | null`
- `deleteSave(id): boolean`
- `listSaves(): SaveMetadata[]`
- `saveExists(id): boolean`
- `getQuickSaveSlot(): SaveMetadata | undefined`
- `calculateChecksum(data): string`
- `startPlayTimeTracking(): void`
- `stopPlayTimeTracking(): void`
- `getPlayTime(): number`

**Function:**
- `formatPlayTime(milliseconds): string`

---

### `WorldSerializer.ts`
World state serialization.

**Methods:**
- `serialize(world): SerializedWorld`
- `deserialize(data, ecsWorld): World`
- `serializeChunks(chunks): SerializedChunk[]`
- `deserializeChunks(data): Chunk[]`

---

### `EntitySerializer.ts`
Entity state serialization.

**Methods:**
- `serialize(entity): SerializedEntity`
- `deserialize(data, ecsWorld): Entity`
- `serializeComponent(component): SerializedComponent`
- `deserializeComponent(data): Component`

---

### `StorageProvider` (Interface)
```typescript
interface StorageProvider {
  save(id: string, data: string): void;
  load(id: string): string | null;
  delete(id: string): boolean;
  list(): string[];
  exists(id: string): boolean;
}
```

**Implementations:**
- `LocalStorageProvider` - Browser localStorage
- `MemoryStorageProvider` - In-memory storage

---

## Content System

### `ContentManager` (Class)
Mod and content pack management.

**Properties:**
- `eventBus: EventBus`
- `contentLoader: ContentLoader`
- `mapLoader: MapLoader`
- `modLoader: ModLoader`

**Methods:**
- `constructor(eventBus)`
- `loadMod(path): Promise<Mod>`
- `loadContentPack(path): Promise<ContentPack>`
- `loadMap(path): Promise<World>`
- `getLoadedMods(): Mod[]`
- `getLoadedContentPacks(): ContentPack[]`
- `getAvailableMaps(): MapMetadata[]`
- `initializeMods(engine): void`
- `createWorld(config): World`
- `registerGenerator(name, generator): void`
- `clear(): void`

---

### `WorldGenerator` (Class)
Procedural world generation.

**Interface:**
```typescript
interface GeneratorContext {
  world: World;
  ecsWorld: ECSWorld;
  rng: RNG;
  params: Record<string, any>;
}

type ChunkGenerator = (
  chunk: Chunk,
  context: GeneratorContext
) => void;
```

**Properties:**
- `eventBus: EventBus`
- `generators: Map<string, ChunkGenerator>`

**Methods:**
- `constructor(eventBus)`
- `registerGenerator(name, generator): void`
- `getGenerator(name): ChunkGenerator | undefined`
- `generateWorld(world, config): void`
- `generateWorldLayer(world, layerId, config): void`
- `generateChunk(chunk, generatorName, params): void`
- `countWallNeighbors(chunk, x, y): number`
- `registerDefaultGenerators(): void`

---

### `ContentLoader.ts`
Resource loading utilities.

**Methods:**
- `loadJSON(path): Promise<any>`
- `loadText(path): Promise<string>`
- `loadImage(path): Promise<HTMLImageElement>`
- `loadModFile(path): Promise<ModManifest>`

---

### `MapLoader.ts`
Map file loading.

**Methods:**
- `loadMap(path): Promise<World>`
- `loadFromJSON(data): World`
- `loadFromTiled(path): Promise<World>`
- `validateMap(data): boolean`

---

### `ModLoader.ts`
Mod loading and management.

**Methods:**
- `loadMod(manifest): Promise<Mod>`
- `unloadMod(id): boolean`
- `getLoadedMods(): Mod[]`
- `isModLoaded(id): boolean`
- `getModOrder(): string[]`
- `resolveDependencies(manifest): boolean`

---

## Interaction System

### `LookMode` (Class)
Examine mode for looking at entities.

**Properties:**
- `engine: Engine`
- `cursorX: number`
- `cursorY: number`
- `isActive: boolean`

**Methods:**
- `constructor(engine)`
- `enter(): void`
- `exit(): void`
- `moveCursor(dx, dy): void`
- `getTargetAtCursor(): Entity[]`
- `getDescription(): string`
- `executeAction(): void`
- `handleInput(key): boolean`

---

### `ContextualAction` (Class)
Context-sensitive action handling.

**Methods:**
- `getActions(entity, target): ContextualAction[]`
- `execute(action): boolean`
- `isValid(entity, target): boolean`

**Types:**
```typescript
interface ContextualAction {
  id: string;
  name: string;
  key: string;
  description: string;
  execute: () => boolean;
}
```

---

## UI Components

### `LookPanel` (Class)
Information panel for examine mode.

**Properties:**
- `displayManager: DisplayManager`
- `position: { x, y }`
- `size: { width, height }`

**Methods:**
- `constructor(displayManager, config?)`
- `render(target): void`
- `clear(): void`
- `setPosition(x, y): void`

---

### `InventoryPanel` (Class)
Inventory display and interaction.

**Properties:**
- `displayManager: DisplayManager`
- `inventory: Inventory`
- `selectedIndex: number`
- `scrollOffset: number`

**Methods:**
- `constructor(displayManager)`
- `setInventory(inventory): void`
- `render(): void`
- `handleInput(key): boolean`
- `selectItem(index): void`
- `scrollUp(): void`
- `scrollDown(): void`

---

### `CrosshairRenderer` (Class)
Cursor visualization.

**Properties:**
- `displayManager: DisplayManager`
- `position: { x, y }`
- `visible: boolean`

**Methods:**
- `constructor(displayManager)`
- `setPosition(x, y): void`
- `show(): void`
- `hide(): void`
- `render(): void`

---

## Configuration Files

### `ActionCosts.ts`
```typescript
ActionCosts = {
  MOVE: 100,
  ATTACK: 150,
  INTERACT: 100,
  WAIT: 50,
  CRAFT: 500,
  PICKUP: 100,
  DROP: 50,
  ASCEND: 200,
  DESCEND: 200
}
```

### `WorldDefaults.ts`
```typescript
WorldDefaults = {
  CHUNK_SIZE: 32,
  MAX_LAYERS: 10,
  DEFAULT_VIEWPORT: { width: 80, height: 24 },
  FOV_RADIUS: 12,
  UPDATE_SCHEDULE: [0, 5, 10, 20, 50]
}
```

---

## Index Files (Public APIs)

### `src/index.ts`
Main library exports:
- `Engine`
- `Config`
- `EventBus`
- `ECSWorld`, `Entity`, `Component`
- `World`, `ChunkManager`
- `DisplayManager`, `Renderer`, `Camera`
- `TurnManager`, `ActorSystem`
- `PhysicsSystem`, `FOVSystem`, `Pathfinding`
- `AISystem`
- `ItemManager`, `InventoryManager`
- `CraftingSystem`
- `SaveManager`
- `ContentManager`, `WorldGenerator`
- All types and interfaces

### Module Index Files
Each module exports its public API:
- `src/core/index.ts`
- `src/ecs/index.ts`
- `src/world/index.ts`
- `src/display/index.ts`
- `src/time/index.ts`
- `src/physics/index.ts`
- `src/ai/index.ts`
- `src/items/index.ts`
- `src/crafting/index.ts`
- `src/save/index.ts`
- `src/content/index.ts`
- `src/interaction/index.ts`
