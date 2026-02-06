# ASCII World Game Engine Architecture

**Project**: 2D ASCII Game Engine using rot.js  
**Goal**: Open-world survival game engine (CDDA-style)  
**Technology**: TypeScript + rot.js  
**Last Updated**: 2026-02-03  
**Phase**: 4 of 4 (Complete)

---

See [https://ondras.github.io/rot.js/doc/](https://ondras.github.io/rot.js/doc/) for rot.js documentation.

## Core Design Decisions

### 1. World Bounds
- **Size**: Flexible parameter, default 1000x1000 tiles
- **Type**: Bounded, pre-generated/manually created worlds
- **Chunk Size**: 64x64 tiles per chunk
- **Total Chunks**: ~256 chunks (16x16 grid for 1000x1000 world)
- **Map Selection**: Multiple pre-created worlds available for selection

### 2. Turn System
- **Type**: Strict turn-based
- **Speed Mechanic**: Actions have varying tick costs based on actor speed
  - Speed 100: Normal (1 tick per standard action)
  - Speed 50: Slow (2 ticks per standard action)
  - Speed 200: Fast (0.5 ticks per standard action)
- **Scheduler**: rot.js `Scheduler.Speed` for handling variable speeds

### 3. Entity Update System
- **Active Zone**: Player chunk + 8 neighboring chunks (3x3 grid)
- **Update Frequency**: Distance-based scheduling
  - Distance 0-1: Every turn (full updates)
  - Distance 2-3: Every 5 turns
  - Distance 4-6: Every 20 turns
  - Distance 7+: Every 100 turns
- **Post-Hoc Updates**: Time-based effects catch up when entities re-enter active zone
  - Hunger, thirst, status effects calculated for missed turns
  - NPCs summarize actions taken ("moved to market", "crafted item")
  - Health/mana regeneration applied

### 4. Persistence Format
- **Format**: JSON (human-readable)
- **Compression**: Optional gzip for large saves
- **Schema Versioning**: For save migration support

### 5. Modding System
- **JSON**: Data definitions (items, creatures, terrains, recipes)
- **JS Extensions**: Custom behaviors, AI, systems (no sandbox)
- **Structure**: Content loaded from `content/` directory
  - `content/maps/`: Pre-created worlds
  - `content/core/`: Built-in JSON content
  - `content/mods/`: User extensions with JS

---

## Project Structure

```
ascii-world/
├── src/
│   ├── core/                    # Engine foundation
│   │   ├── Engine.ts             # Main game loop, initialization
│   │   ├── Config.ts               # Configuration management
│   │   ├── EventBus.ts             # Pub/sub event system
│   │   └── Types.ts                # Common type definitions
│   ├── display/                  # Rendering system
│   │   ├── DisplayManager.ts       # rot.js Display wrapper
│   │   ├── Camera.ts               # Viewport management
│   │   ├── Renderer.ts             # Rendering orchestration
│   │   └── UI/                     # User interface components
│   ├── world/                    # World management
│   │   ├── World.ts                # World container
│   │   ├── WorldConfig.ts          # Default world parameters
│   │   ├── MapManager.ts           # Multiple map support
│   │   ├── MapMetadata.ts          # Map information
│   │   ├── Chunk.ts                # 64x64 tile chunk
│   │   ├── ChunkManager.ts         # Chunk lifecycle
│   │   └── UpdateScheduler.ts      # Distance-based updates
│   ├── time/                     # Turn/time management
│   │   ├── TurnManager.ts          # Turn coordinator
│   │   ├── SpeedSystem.ts          # Action cost calculation
│   │   ├── Action.ts               # Action definitions
│   │   ├── DeferredUpdateSystem.ts # Post-hoc updates
│   │   ├── CatchUpCalculator.ts    # Missed effect simulation
│   │   └── PostHocUpdateQueue.ts   # Deferred processing queue
│   ├── ecs/                      # Entity Component System
│   │   ├── World.ts                # ECS world
│   │   ├── Entity.ts               # Entity definition
│   │   ├── Component.ts            # Base component
│   │   ├── System.ts               # Base system
│   │   └── SystemManager.ts        # System execution
│   ├── physics/                  # Physics & interactions
│   │   ├── PhysicsSystem.ts        # Collision, movement
│   │   ├── FOVSystem.ts            # Field of view (rot.js)
│   │   ├── LightingSystem.ts       # Dynamic lighting
│   │   └── Pathfinding.ts          # A* / Dijkstra
│   ├── items/                    # Item system
│   │   ├── Item.ts
│   │   ├── ItemManager.ts
│   │   └── Inventory.ts
│   ├── crafting/                 # Crafting & construction
│   │   ├── Recipe.ts
│   │   ├── CraftingSystem.ts
│   │   └── ConstructionSystem.ts
│   ├── ai/                       # AI system
│   │   ├── AISystem.ts
│   │   ├── BehaviorTree.ts
│   │   └── FactionSystem.ts
│   ├── save/                     # Save/load system
│   │   ├── SaveManager.ts
│   │   ├── WorldSerializer.ts
│   │   └── EntitySerializer.ts
│   └── content/                  # Content loading
│       ├── ContentLoader.ts
│       ├── ModLoader.ts
│       └── ContentManager.ts
├── content/
│   ├── maps/                     # Pre-created worlds
│   │   ├── world_default/        # Default 1000x1000
│   │   ├── world_small/          # 500x500 test
│   │   └── world_city/           # Urban map
│   ├── core/                     # Built-in JSON content
│   │   ├── items/
│   │   ├── creatures/
│   │   ├── terrains/
│   │   └── recipes/
│   └── mods/                     # User JS extensions
│       └── example_mod/
├── tests/                        # Test suite
├── docs/                         # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

---

## Key Configuration

### World Defaults (src/config/WorldDefaults.ts)

```typescript
export const WORLD_DEFAULTS = {
  width: 1000,           // Tiles
  height: 1000,          // Tiles
  chunkSize: 64,         // Tiles per chunk
  chunkCount: { x: 16, y: 16 },  // 256 total chunks
  maxActiveChunks: 9,    // 3x3 grid around player
  fullUpdateDistance: 1, // Chunks
  courseUpdateSchedule: [
    { minDist: 2, maxDist: 3, interval: 5 },      // Turns
    { minDist: 4, maxDist: 6, interval: 20 },
    { minDist: 7, maxDist: Infinity, interval: 100 }
  ]
};
```

### Action Costs (src/time/ActionCost.ts)

```typescript
export const ACTION_COSTS = {
  MOVE: 100,
  ATTACK: 100,
  CRAFT: 300,
  WAIT: 50,
  INTERACT: 100,
  PICKUP: 50,
  DROP: 25
};
```

---

## System Interactions

### Turn Processing Flow

```
1. TurnManager.processTurn()
   ├── Get next actor from rot.js Scheduler.Speed
   ├── Actor.act() executes
   │   ├── Queue actions with costs
   │   └── Deduct speed-based tick costs
   ├── UpdateScheduler.update()
   │   ├── Full updates for active chunks (0-1 distance)
   │   ├── Course updates for distant chunks (by schedule)
   │   └── Track last update timestamps
   └── Advance turn counter
```

### Chunk Activation Flow (Post-Hoc Updates)

```
1. Player moves to new chunk
2. ChunkManager.activateChunk(newChunk)
   ├── Add to activeChunks set
   ├── Calculate turns since last update
   └── Check needsCatchUp flag
3. If needsCatchUp:
   PostHocUpdateQueue.queueEntity(entity, missedTurns)
4. Process catch-up for all entities:
   DeferredUpdateSystem.processCatchUp(entity, turns)
   ├── Calculate hunger/thirst delta
   ├── Simulate status effects
   ├── Generate NPC action summaries
   └── Apply accumulated changes
5. Clear needsCatchUp flag
```

### Save/Load Flow

```
Save:
1. SaveManager.createSave(slot, metadata)
2. WorldSerializer.serializeWorld(world)
   ├── Serialize world metadata
   ├── Serialize all chunks
   └── Serialize player state
3. Compress and write to storage

Load:
1. SaveManager.loadSave(slot)
2. WorldSerializer.deserializeWorld(json)
   ├── Load world metadata
   ├── Deserialize chunks (lazy load)
   └── Restore player state
3. Activate starting chunk
```

---

## Implementation Phases

### Phase 1: Foundation ✓ Complete
- [x] TypeScript project setup (2026-02-03)
  - `package.json` with rot.js and TypeScript dependencies
  - `tsconfig.json` with strict mode configuration
  - All npm packages installed (npm install)
  - TypeScript compiles without errors (`npm run typecheck` ✓)
- [x] Basic file structure (2026-02-03)
  - 11 source directories created (`src/core`, `src/world`, `src/time`, etc.)
  - 17 TypeScript source files with module stubs
  - `content/` directory structure for maps/mods
  - Configuration files: `WorldDefaults.ts`, `ActionCosts.ts`

### Phase 2: Core Systems ✓ Complete (2026-02-03)
- [x] rot.js integration
  - Display wrapper with `DisplayManager` class
  - Camera/viewport management
  - Renderer with `Renderable` interface
  - TypeScript definitions verified
- [x] ECS framework
  - Entity class with component management
  - ECSWorld for entity and system coordination
  - BaseSystem class for system implementations
  - Query system with `all`/`any`/`none` filters
  - Standard components (Position, Health, Speed, Actor, Renderable)
- [x] World and chunk management
  - Chunk class (64x64 tiles)
  - ChunkManager with distance-based activation
  - World container with bounds checking
  - UpdateScheduler with distance-based update frequencies
  - Terrain definitions (floor, wall, water, tree, door, stairs)
  - MapManager for multiple map support
- [x] Turn system with speed
  - Speed-based scheduler using rot.js `Scheduler.Speed`
  - TurnManager with async turn processing
  - Actor interface for turn participants
  - SpeedSystem for action cost calculation
  - Action factory methods (move, attack, craft, wait, etc.)
- [x] Basic movement/interaction
  - PhysicsSystem with collision detection
  - Direction-based movement with 8 directions
  - Event-driven movement notifications
  - FOVSystem using rot.js FOV
  - LightingSystem with dynamic light sources
  - Pathfinding with A* and Dijkstra algorithms

### Phase 3: Advanced Features ✓ Complete (2026-02-03)
- [x] Post-hoc update system (implemented in Phase 2)
- [x] FOV and lighting (implemented in Phase 2)
- [x] Item system
  - Item class with properties (weight, volume, durability, stackable)
  - ItemManager for template registry and instance spawning
  - Inventory class with weight/volume capacity management
  - InventoryManager for container coordination
  - Stackable items support
  - Equippable items support
  - Item damage/repair system
- [x] Save/load system
  - SaveManager with slot management and metadata tracking
  - LocalStorageProvider for persistence
  - WorldSerializer for world state serialization
  - EntitySerializer for ECS entity/component serialization
  - Item and inventory serialization
  - Checksum validation for save integrity

### Phase 4: Content ✓ Complete (2026-02-03)
- [x] Content loading pipeline
  - ContentPack interface for bundling items, creatures, recipes, terrains
  - ContentLoader for loading JSON content packs with dependency checking
  - Terrain override system
  - Recipe definitions with ingredients, results, and requirements
- [x] Multiple maps support
  - MapDefinition interface with predefined chunks and spawn points
  - MapLoader for loading map JSON and creating worlds
  - Map metadata for UI map selection
- [x] Mod system
  - Mod interface with initialize() and cleanup() lifecycle
  - ModLoader with dependency resolution and loading order
  - ModAPI for content registration (items, creatures, recipes, terrains, generators)
  - Entity and item spawning through mod API
- [x] World generation tools
  - WorldGenerator with pluggable chunk generators
  - Built-in generators: wilderness, dungeon, cave, city
  - Cellular automata cave generation
  - Room-based dungeon generation with corridors
  - City grid generation with building blocks

---

## Content Format Examples

### Content Pack (JSON)

```json
{
  "id": "core_content",
  "name": "Core Content Pack",
  "version": "1.0.0",
  "author": "ASCII World Team",
  "description": "Core items, creatures, and recipes",
  "items": [
    {
      "id": "sword_steel",
      "name": "Steel Sword",
      "description": "A sharp steel blade",
      "category": "weapon",
      "character": "/",
      "foreground": "#c0c0c0",
      "properties": {
        "weight": 1.5,
        "volume": 3,
        "durability": 150,
        "maxDurability": 150,
        "value": 100
      }
    },
    {
      "id": "bandage",
      "name": "Bandage",
      "description": "Stops bleeding and heals wounds",
      "category": "consumable",
      "character": "=",
      "foreground": "#ffffff",
      "properties": {
        "weight": 0.1,
        "volume": 0.1,
        "stackable": true,
        "maxStack": 20,
        "value": 5
      }
    }
  ],
  "creatures": [
    {
      "id": "goblin",
      "name": "Goblin",
      "description": "A small, green humanoid",
      "character": "g",
      "foreground": "#00aa00",
      "health": 30,
      "speed": 100,
      "faction": "hostile",
      "tags": ["humanoid", "hostile"],
      "ai": {
        "type": "aggressive",
        "aggression": 0.7,
        "visionRange": 8
      },
      "loot": ["sword_iron", "gold_coin"]
    }
  ],
  "recipes": [
    {
      "id": "craft_bandage",
      "name": "Craft Bandage",
      "description": "Make a bandage from cloth",
      "category": "crafting",
      "ingredients": [
        { "itemId": "cloth", "quantity": 2 }
      ],
      "results": [
        { "itemId": "bandage", "quantity": 1 }
      ],
      "timeCost": 50,
      "requiredSkills": { "survival": 1 }
    }
  ],
  "terrains": [
    {
      "id": "sand",
      "name": "Sand",
      "character": ".",
      "foreground": "#ffff00",
      "background": "#000000",
      "blocksMovement": false,
      "blocksLight": false,
      "transparent": true
    }
  ]
}
```

### Map Definition (JSON)

```json
{
  "id": "dungeon_level_1",
  "name": "Level 1 - The Entrance",
  "description": "The upper level of the ancient dungeon",
  "width": 500,
  "height": 500,
  "chunkSize": 64,
  "generator": "dungeon",
  "generatorParams": {
    "roomChance": 0.4,
    "seed": 12345
  },
  "predefinedChunks": [
    {
      "chunkX": 0,
      "chunkY": 0,
      "tiles": [
        ["wall", "wall", "wall"],
        ["wall", "floor", "door"],
        ["wall", "wall", "wall"]
      ],
      "entities": [
        { "x": 1, "y": 1, "type": "item", "templateId": "sword_iron" }
      ]
    }
  ],
  "spawnPoints": [
    {
      "x": 32,
      "y": 32,
      "type": "player",
      "tags": ["start"]
    },
    {
      "x": 48,
      "y": 16,
      "type": "npc",
      "tags": ["merchant"]
    }
  ]
}
```

### Available Generators

- **wilderness**: Forests, clearings, water (params: `treeDensity`, `waterChance`)
- **dungeon**: Rooms and corridors (params: `roomChance`)
- **cave**: Cellular automata caves (params: `fillPercent`, `iterations`)
- **city**: Grid streets and buildings (params: `blockSize`, `buildingDensity`)

---

## Dependencies

```json
{
  "rot-js": "^2.2.0",
  "typescript": "^5.0.0"
}
```

## Notes for Future Development

- Consider Web Worker for chunk generation to avoid blocking UI
- Implement spatial hash for entity queries in large worlds
- Add chunk compression for distant/unloaded chunks in memory
- Consider entity culling for very distant chunks
- Design save format to support partial loading for large worlds

---

## Quick Reference

**World Size**: 1000x1000 tiles (16x16 chunks of 64x64)  
**Active Update Range**: 3x3 chunks around player  
**Post-Hoc Catch-Up**: Calculated when chunks reactivate  
**Turn Type**: Speed-based strict turn-based  
**Content**: JSON data + JS behavior extensions  
**Save Format**: JSON with optional compression
