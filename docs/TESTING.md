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

## Phase 1: Foundation Tests

**Status**: Complete ✅  
**Coverage**: 100% (134/134 statements, 26/26 branches)  
**Tests**: 81 passing

### Tested Modules

#### 1. EventBus (`tests/core/EventBus.test.ts`)

**Purpose**: Pub/sub event system for decoupled communication

**Test Coverage**:
- Event handler registration and emission
- Multiple handlers per event
- Event data passing (primitive and complex types)
- Handler unsubscription (via return value and off method)
- Clear all handlers
- Execution order and context

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
- Singleton pattern enforcement
- Default world configuration (1000x1000, 64x64 chunks)
- Default action costs (MOVE: 100, ATTACK: 100, etc.)
- Debug flag management
- Course update schedule

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
- Unique ID generation (auto-incrementing)
- Component management (add, get, remove, has)
- Component chaining
- Component overwrite behavior

**ECSWorld Class**:
- Entity lifecycle (create, get, remove)
- Entity queries (all, any, none filters)
- Query caching and invalidation
- System management (add, remove, priority sorting)
- System lifecycle hooks (onEntityAdded, onEntityRemoved)
- World lifecycle (start, stop, update)

**Component Factories**:
- createPosition(x, y)
- createVelocity(vx, vy)
- createHealth(current, max)
- createSpeed(value)
- createActor(isPlayer)
- createRenderable(char, fg, bg?)

**BaseSystem**:
- Abstract class behavior
- Optional lifecycle hooks

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
import { createTestPlayer } from '../fixtures/entities';

const player = createTestPlayer(world, {
  x: 10,
  y: 20,
  health: 100,
  speed: 150
});
```

## Testing Best Practices

### 1. Test Organization

- Group tests by functionality using `describe` blocks
- Use descriptive test names: "should [expected behavior]"
- Keep tests independent (no shared state)
- Clean up in `afterEach` hooks

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

- **Phase 1**: 100% coverage achieved
- **Phase 2**: Target 80%+ coverage
- Focus on:
  - Public API methods
  - Edge cases (empty inputs, invalid data)
  - Error conditions
  - State transitions

### 4. Async Testing

For async operations:
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

### 5. Mocking

Mock external dependencies:
```typescript
const handler = jest.fn();
eventBus.on('event', handler);
expect(handler).toHaveBeenCalledWith(expectedData);
```

## Code Changes Made During Testing

### ECSWorld.invalidateCache()

Changed from `private` to `public` to allow manual cache invalidation when components are modified directly on entities.

**Before**:
```typescript
private invalidateCache(): void {
  this.entityQueryCache.clear();
}
```

**After**:
```typescript
invalidateCache(): void {
  this.entityQueryCache.clear();
}
```

**Reason**: Entity components can be modified outside of ECSWorld's knowledge. Tests need to manually invalidate cache after such modifications.

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

## Next Phases

### Phase 2: Core Game Systems (In Progress)

Target modules:
- World/Chunk management
- Turn/Time system
- Items/Inventory
- Physics (FOV, lighting, pathfinding)
- Save/Load system

### Phase 3: Content Systems

Target modules:
- Content loading
- Map generation
- Mod system

### Phase 4: Integration Tests

End-to-end scenarios testing complete game workflows.

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
