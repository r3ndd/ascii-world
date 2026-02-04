# Testing Documentation

## Overview

The ASCII World game engine uses **Jest** with **TypeScript** for unit testing. This document describes the testing strategy, structure, and implementation details.

## Test Configuration

### Jest Setup

```javascript
// jest.config.js
- Preset: ts-jest
- Test environment: node
- Test pattern: **/*.test.ts
- Coverage threshold: 80% (all metrics)
- Coverage reports: Terminal only
```

### NPM Scripts

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:ci       # Run tests for CI (with coverage and verbose)
```

## Test Structure

```
tests/
├── setup.ts                    # Jest setup and global utilities
├── fixtures/                   # Test data factories
│   ├── index.ts               # Fixture exports
│   ├── entities.ts            # Entity factory functions
│   ├── world.ts               # World/Chunk factories
│   ├── content.ts             # Content template factories
│   ├── items.ts               # Item/Inventory factories
│   └── time.ts                # Time system factories
├── core/                      # Core system tests
│   ├── EventBus.test.ts       # Event system tests
│   └── Config.test.ts         # Configuration tests
├── ecs/                       # ECS tests
│   └── index.test.ts          # Entity, ECSWorld, component tests
├── world/                     # World system tests
├── time/                      # Turn/time tests
├── items/                     # Item/Inventory tests
├── physics/                   # Physics tests
├── save/                      # Save system tests
├── content/                   # Content/Mod tests
└── display/                   # Display/Camera tests
```

## Testing Best Practices

### 1. Test Organization

-   Group tests by functionality using `describe` blocks
-   Use descriptive test names: "should [expected behavior]"
-   Keep tests independent (no shared state)
-   Clean up in `afterEach` hooks

### 2. Fixture Usage

Always use fixtures for test data:

```typescript
// Good
const entity = createTestPlayer(world);

// Avoid
const entity = world.createEntity();
entity.addComponent(createPosition(0, 0));
// ... add more components manually
```

### 3. Coverage Requirements

-   **Phase 1**: 100% coverage achieved
-   **Phase 2**: Target 80%+ coverage
-   Focus on:
    -   Public API methods
    -   Edge cases (empty inputs, invalid data)
    -   Error conditions
    -   State transitions

### 4. Async Testing

For async operations:

```typescript
it("should handle async operation", async () => {
    const result = await asyncFunction();
    expect(result).toBe(expected);
});
```

### 5. Mocking

Mock external dependencies:

```typescript
const handler = jest.fn();
eventBus.on("event", handler);
expect(handler).toHaveBeenCalledWith(expectedData);
```

## Running Tests

### Development

```bash
# Watch mode for TDD
npm run test:watch

# Run specific test file
npm test -- tests/core/EventBus.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create"
```

### Coverage Analysis

```bash
# Generate coverage report
npm run test:coverage

# View detailed coverage
npm run test:coverage -- --coverageReporters=text-summary
```

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**

    - Check import paths match tsconfig.json baseUrl
    - Ensure module is exported in index.ts

2. **Coverage not at 80%**

    - Add tests for untested branches
    - Check if private methods need testing
    - Verify all public API is covered

3. **Test timeouts**
    - Check for infinite loops in test code
    - Verify async operations complete
    - Increase timeout if necessary: `jest.setTimeout(10000)`

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Use fixtures for test data
3. Update this documentation
4. Ensure coverage remains above 80%
5. Run `npm run typecheck` before committing

## Phase 1: Foundation Tests

**Status**: Complete ✅
**Coverage**: 100% (134/134 statements, 26/26 branches)
**Tests**: 81 passing

### Tested Modules

#### 1. EventBus (`tests/core/EventBus.test.ts`)

**Purpose**: Pub/sub event system for decoupled communication

**Test Coverage**:

-   Event handler registration and emission
-   Multiple handlers per event
-   Event data passing (primitive and complex types)
-   Handler unsubscription (via return value and off method)
-   Clear all handlers
-   Execution order and context

**Key Tests**:

```typescript
✓ should register an event handler
✓ should register multiple handlers for the same event
✓ should emit events with data
✓ should return an unsubscribe function
✓ should remove all handlers
```

#### 2. Config (`tests/core/Config.test.ts`)

**Purpose**: Singleton configuration management

**Test Coverage**:

-   Singleton pattern enforcement
-   Default world configuration (1000x1000, 64x64 chunks)
-   Default action costs (MOVE: 100, ATTACK: 100, etc.)
-   Debug flag management
-   Course update schedule

**Key Tests**:

```typescript
✓ should create a singleton instance
✓ should have default world configuration
✓ should have default action costs
✓ should set debug flag to true/false
```

#### 3. ECS (Entity Component System) (`tests/ecs/index.test.ts`)

**Purpose**: Core game object management

**Test Coverage**:

**Entity Class**:

-   Unique ID generation (auto-incrementing)
-   Component management (add, get, remove, has)
-   Component chaining
-   Component overwrite behavior

**ECSWorld Class**:

-   Entity lifecycle (create, get, remove)
-   Entity queries (all, any, none filters)
-   Query caching and invalidation
-   System management (add, remove, priority sorting)
-   System lifecycle hooks (onEntityAdded, onEntityRemoved)
-   World lifecycle (start, stop, update)

**Component Factories**:

-   createPosition(x, y)
-   createVelocity(vx, vy)
-   createHealth(current, max)
-   createSpeed(value)
-   createActor(isPlayer)
-   createRenderable(char, fg, bg?)

**BaseSystem**:

-   Abstract class behavior
-   Optional lifecycle hooks

**Key Tests**:

```typescript
✓ should create an entity with a unique ID
✓ should support chaining multiple components
✓ should query entities with all specified components
✓ should cache query results
✓ should invalidate cache when entity is added/removed
✓ should sort systems by priority
✓ should notify system of existing matching entities on add
```

### Test Fixtures

**Entity Fixtures** (`tests/fixtures/entities.ts`):

```typescript
createTestEntity(world, components?)     // Basic entity
createTestActor(world, options?)         // Entity with actor components
createTestPlayer(world, options?)        // Player entity
createTestNPC(world, options?)           // NPC entity
```

**Usage Example**:

```typescript
import { createTestPlayer } from "../fixtures/entities";

const player = createTestPlayer(world, {
    x: 10,
    y: 20,
    health: 100,
    speed: 150,
});
```

## Phase 2: Core Game Systems ✅ Complete

**Status**: All Tests Passing (2026-02-03)
**Test Coverage**: 8/8 test suites passing (100% of tests passing)
**Tests**: 358 passing, 0 failing

### Implemented Test Modules

#### 1. World System (`tests/world/index.test.ts`)

-   Chunk creation and management
-   Tile operations (get/set)
-   Entity management within chunks
-   Position conversion (world/local)
-   Update scheduling
-   Map manager (registration, loading)
-   TERRAIN definitions validation

**Status**: All tests passing ✅

#### 2. Time/Turn System (`tests/time/index.test.ts`)

-   Action factory methods with speed-based costs
-   SpeedSystem calculation logic
-   TurnManager actor registration/removal
-   Turn processing and event emission
-   Post-hoc update queue
-   DeferredUpdateSystem catch-up processing
-   CatchUpCalculator regeneration/hunger calculations

**Status**: All tests passing ✅

#### 3. Items/Inventory (`tests/items/index.test.ts`)

-   Item properties (weight, volume, durability)
-   Item damage/repair system
-   Item stacking logic
-   Equipment system
-   ItemManager template registry
-   Item spawning and retrieval
-   Inventory capacity management
-   Item transfer between inventories
-   Serialization/deserialization

**Status**: All tests passing ✅

#### 4. Physics System (`tests/physics/index.test.ts`)

-   PhysicsSystem movement validation
-   8-directional movement
-   FOVSystem computation
-   LightingSystem with dynamic sources
-   Pathfinding (A\* and Dijkstra)

**Status**: All tests passing ✅

#### 5. Save/Load System (`tests/save/index.test.ts`)

-   LocalStorageProvider operations
-   WorldSerializer chunk serialization
-   EntitySerializer component handling
-   SaveManager create/load/delete
-   Quick save/load functionality
-   Play time tracking
-   Checksum validation

**Status**: All tests passing ✅

### Phase 3: Content Systems ✅ Complete (2026-02-04)

**Status**: All Tests Passing
**Test Coverage**: 76% statements, 71% branches
**Tests**: 93 new tests added

#### Tested Modules

**1. ContentLoader (`tests/content/index.test.ts`)**

- Content pack loading with dependency checking
- JSON parsing and validation
- Item/creature/recipe/terrain template collection from multiple packs
- Terrain override registration and application
- Event emission for content loading

**2. MapLoader (`tests/content/index.test.ts`)**

- Map definition loading and retrieval
- World creation from map definitions
- Predefined chunk application (tiles and entities)
- Spawn point processing
- Generator parameter overrides
- Event emission for map operations

**3. WorldGenerator (`tests/content/index.test.ts`)**

- Custom generator registration
- All 4 built-in generators:
  - **Wilderness**: Trees, water, floor with border walls
  - **Dungeon**: Rooms, corridors, doors
  - **Cave**: Cellular automata with fillPercent parameter
  - **City**: Street grid, buildings, trees
- Seed-based generation
- Event emission for generation start

**4. ModLoader (`tests/content/index.test.ts`)**

- Mod loading with dependency resolution
- Mod initialization with ModAPI
- Cleanup in reverse load order
- Error handling for init/cleanup failures
- Mod unloading and reload prevention
- Event emission for mod lifecycle

**5. ModAPI (`tests/content/index.test.ts`)**

- Terrain registration through mods
- Custom generator registration
- Entity creation with event emission
- Item spawning with itemManager integration
- Error handling for missing dependencies

**6. ContentManager (`tests/content/index.test.ts`)**

- Facade pattern combining all content systems
- Content pack loading from JSON
- Map loading and world creation
- Mod loading and initialization
- Custom generator registration
- Clear/cleanup operations

### Phase 4: Integration Tests

End-to-end scenarios testing complete game workflows.
