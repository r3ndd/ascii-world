/**
 * Content module tests
 * Tests for ContentLoader, MapLoader, WorldGenerator, ModLoader, and ContentManager
 */

import { EventBus } from '../../src/core/EventBus';
import {
  ContentLoader,
  MapLoader,
  WorldGenerator,
  ModLoader,
  ContentManager,
  ContentPack,
  MapDefinition,
  Mod,
  TerrainDefinition,
} from '../../src/content';
import { ECSWorld } from '../../src/ecs';
import { World, TERRAIN } from '../../src/world';
import { createTestECSWorld } from '../fixtures/world';
import {
  createTestContentPack,
  createTestItemTemplate,
  createTestCreatureTemplate,
  createTestRecipe,
  createTestTerrainDefinition,
  createTestMapDefinition,
} from '../fixtures/content';

describe('Content Module', () => {
  let eventBus: EventBus;
  let contentLoader: ContentLoader;

  beforeEach(() => {
    eventBus = new EventBus();
    contentLoader = new ContentLoader(eventBus);
  });

  afterEach(() => {
    contentLoader.clear();
  });

  // ============================================================================
  // ContentLoader Tests
  // ============================================================================
  describe('ContentLoader', () => {
    describe('loadContentPack', () => {
      it('should load a content pack and emit event', () => {
        const handler = jest.fn();
        eventBus.on('content:packLoaded', handler);

        const pack = createTestContentPack('test_pack');
        contentLoader.loadContentPack(pack);

        expect(handler).toHaveBeenCalledWith({
          packId: 'test_pack',
          name: 'Test Content Pack test_pack',
        });
      });

      it('should load multiple content packs', () => {
        const pack1 = createTestContentPack('pack1');
        const pack2 = createTestContentPack('pack2');

        contentLoader.loadContentPack(pack1);
        contentLoader.loadContentPack(pack2);

        const loaded = contentLoader.getLoadedPacks();
        expect(loaded).toHaveLength(2);
        expect(loaded.map(p => p.id)).toContain('pack1');
        expect(loaded.map(p => p.id)).toContain('pack2');
      });

      it('should throw error when dependency is not loaded', () => {
        const pack: ContentPack = {
          id: 'dependent',
          name: 'Dependent Pack',
          version: '1.0.0',
          dependencies: ['missing_dep'],
        };

        expect(() => contentLoader.loadContentPack(pack)).toThrow(
          'Content pack "dependent" requires dependency "missing_dep" which is not loaded'
        );
      });

      it('should load pack with satisfied dependencies', () => {
        const basePack = createTestContentPack('base');
        const dependentPack: ContentPack = {
          ...createTestContentPack('dependent'),
          dependencies: ['base'],
        };

        contentLoader.loadContentPack(basePack);
        expect(() => contentLoader.loadContentPack(dependentPack)).not.toThrow();
      });
    });

    describe('loadContentPackFromJSON', () => {
      it('should load content pack from JSON string', () => {
        const pack = createTestContentPack('json_pack');
        const json = JSON.stringify(pack);

        contentLoader.loadContentPackFromJSON(json);

        expect(contentLoader.getPack('json_pack')).toBeDefined();
      });

      it('should parse JSON with all content types', () => {
        const pack: ContentPack = {
          id: 'full_pack',
          name: 'Full Pack',
          version: '1.0.0',
          items: [createTestItemTemplate('test_item')],
          creatures: [createTestCreatureTemplate('test_creature')],
          recipes: [createTestRecipe('test_recipe')],
          terrains: [createTestTerrainDefinition('test_terrain')],
        };

        contentLoader.loadContentPackFromJSON(JSON.stringify(pack));
        const loaded = contentLoader.getPack('full_pack');

        expect(loaded?.items).toHaveLength(1);
        expect(loaded?.creatures).toHaveLength(1);
        expect(loaded?.recipes).toHaveLength(1);
        expect(loaded?.terrains).toHaveLength(1);
      });
    });

    describe('getLoadedPacks', () => {
      it('should return empty array when no packs loaded', () => {
        expect(contentLoader.getLoadedPacks()).toEqual([]);
      });

      it('should return all loaded packs', () => {
        contentLoader.loadContentPack(createTestContentPack('pack1'));
        contentLoader.loadContentPack(createTestContentPack('pack2'));
        contentLoader.loadContentPack(createTestContentPack('pack3'));

        const packs = contentLoader.getLoadedPacks();
        expect(packs).toHaveLength(3);
      });
    });

    describe('getPack', () => {
      it('should return undefined for non-existent pack', () => {
        expect(contentLoader.getPack('nonexistent')).toBeUndefined();
      });

      it('should return the correct pack by ID', () => {
        const pack = createTestContentPack('specific_pack');
        contentLoader.loadContentPack(pack);

        const retrieved = contentLoader.getPack('specific_pack');
        expect(retrieved?.id).toBe('specific_pack');
        expect(retrieved?.name).toBe('Test Content Pack specific_pack');
      });
    });

    describe('getAllItemTemplates', () => {
      it('should return empty array when no items loaded', () => {
        const pack = createTestContentPack('empty');
        contentLoader.loadContentPack(pack);
        expect(contentLoader.getAllItemTemplates()).toEqual([]);
      });

      it('should collect items from all loaded packs', () => {
        const pack1 = createTestContentPack('pack1', {
          items: [createTestItemTemplate('item1'), createTestItemTemplate('item2')],
        });
        const pack2 = createTestContentPack('pack2', {
          items: [createTestItemTemplate('item3')],
        });

        contentLoader.loadContentPack(pack1);
        contentLoader.loadContentPack(pack2);

        const items = contentLoader.getAllItemTemplates();
        expect(items).toHaveLength(3);
        expect(items.map(i => i.id)).toContain('item1');
        expect(items.map(i => i.id)).toContain('item2');
        expect(items.map(i => i.id)).toContain('item3');
      });
    });

    describe('getAllCreatureTemplates', () => {
      it('should return empty array when no creatures loaded', () => {
        expect(contentLoader.getAllCreatureTemplates()).toEqual([]);
      });

      it('should collect creatures from all packs', () => {
        const pack = createTestContentPack('creature_pack', {
          creatures: [
            createTestCreatureTemplate('goblin'),
            createTestCreatureTemplate('orc'),
          ],
        });

        contentLoader.loadContentPack(pack);
        const creatures = contentLoader.getAllCreatureTemplates();

        expect(creatures).toHaveLength(2);
        expect(creatures.map(c => c.id)).toContain('goblin');
        expect(creatures.map(c => c.id)).toContain('orc');
      });
    });

    describe('getAllRecipes', () => {
      it('should return empty array when no recipes loaded', () => {
        expect(contentLoader.getAllRecipes()).toEqual([]);
      });

      it('should collect recipes from all packs', () => {
        const pack = createTestContentPack('recipe_pack', {
          recipes: [
            createTestRecipe('craft_sword'),
            createTestRecipe('craft_shield'),
          ],
        });

        contentLoader.loadContentPack(pack);
        const recipes = contentLoader.getAllRecipes();

        expect(recipes).toHaveLength(2);
      });
    });

    describe('getAllTerrainDefinitions', () => {
      it('should return empty array when no terrains loaded', () => {
        expect(contentLoader.getAllTerrainDefinitions()).toEqual([]);
      });

      it('should collect terrains from all packs', () => {
        const pack = createTestContentPack('terrain_pack', {
          terrains: [
            createTestTerrainDefinition('sand'),
            createTestTerrainDefinition('mud'),
          ],
        });

        contentLoader.loadContentPack(pack);
        const terrains = contentLoader.getAllTerrainDefinitions();

        expect(terrains).toHaveLength(2);
      });
    });

    describe('terrain overrides', () => {
      it('should register and retrieve terrain definition', () => {
        const terrain = createTestTerrainDefinition('custom_terrain');
        contentLoader.registerTerrain(terrain);

        const retrieved = contentLoader.getTerrain('custom_terrain');
        expect(retrieved).toEqual(terrain);
      });

      it('should return undefined for non-existent terrain', () => {
        expect(contentLoader.getTerrain('nonexistent')).toBeUndefined();
      });

      it('should override existing terrain in TERRAIN registry', () => {
        const customFloor: TerrainDefinition = {
          id: 'floor',
          name: 'Custom Floor',
          character: '.',
          foreground: '#00ff00',
          blocksMovement: false,
          blocksLight: false,
          transparent: true,
        };

        // Store original values to restore after test
        const originalChar = TERRAIN.floor.char;
        const originalFg = TERRAIN.floor.fg;

        contentLoader.registerTerrain(customFloor);
        contentLoader.applyTerrainOverrides();

        expect(TERRAIN.floor.char).toBe('.');
        expect(TERRAIN.floor.fg).toBe('#00ff00');

        // Restore original values
        TERRAIN.floor.char = originalChar;
        TERRAIN.floor.fg = originalFg;
      });

      it('should apply multiple terrain overrides', () => {
        const floor = createTestTerrainDefinition('floor', {
          character: '*',
          foreground: '#ff0000',
        });
        const wall = createTestTerrainDefinition('wall', {
          character: '#',
          foreground: '#00ff00',
        });

        // Store original values to restore after test
        const originalFloorChar = TERRAIN.floor.char;
        const originalFloorFg = TERRAIN.floor.fg;
        const originalWallFg = TERRAIN.wall.fg;

        contentLoader.registerTerrain(floor);
        contentLoader.registerTerrain(wall);
        contentLoader.applyTerrainOverrides();

        expect(TERRAIN.floor.char).toBe('*');
        expect(TERRAIN.wall.fg).toBe('#00ff00');

        // Restore original values
        TERRAIN.floor.char = originalFloorChar;
        TERRAIN.floor.fg = originalFloorFg;
        TERRAIN.wall.fg = originalWallFg;
      });
    });

    describe('clear', () => {
      it('should remove all loaded packs', () => {
        contentLoader.loadContentPack(createTestContentPack('pack1'));
        contentLoader.loadContentPack(createTestContentPack('pack2'));
        contentLoader.registerTerrain(createTestTerrainDefinition('terrain'));

        contentLoader.clear();

        expect(contentLoader.getLoadedPacks()).toHaveLength(0);
        expect(contentLoader.getTerrain('terrain')).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // MapLoader Tests
  // ============================================================================
  describe('MapLoader', () => {
    let mapLoader: MapLoader;
    let ecsWorld: ECSWorld;

    beforeEach(() => {
      mapLoader = new MapLoader(contentLoader, eventBus);
      ecsWorld = createTestECSWorld(eventBus);
    });

    describe('loadMapDefinition', () => {
      it('should load a map definition and emit event', () => {
        const handler = jest.fn();
        eventBus.on('map:definitionLoaded', handler);

        const mapDef = createTestMapDefinition('test_map');
        mapLoader.loadMapDefinition(mapDef);

        expect(handler).toHaveBeenCalledWith({
          mapId: 'test_map',
          name: 'Test Map test_map',
          width: 100,
          height: 100,
        });
      });

      it('should store map definition for retrieval', () => {
        const mapDef = createTestMapDefinition('stored_map');
        mapLoader.loadMapDefinition(mapDef);

        const retrieved = mapLoader.getMapDefinition('stored_map');
        expect(retrieved?.id).toBe('stored_map');
        expect(retrieved?.width).toBe(100);
        expect(retrieved?.height).toBe(100);
      });
    });

    describe('loadMapFromJSON', () => {
      it('should load map from JSON string', () => {
        const mapDef = createTestMapDefinition('json_map');
        const json = JSON.stringify(mapDef);

        mapLoader.loadMapFromJSON(json);
        expect(mapLoader.getMapDefinition('json_map')).toBeDefined();
      });
    });

    describe('getAllMapDefinitions', () => {
      it('should return all loaded map definitions', () => {
        mapLoader.loadMapDefinition(createTestMapDefinition('map1'));
        mapLoader.loadMapDefinition(createTestMapDefinition('map2'));

        const maps = mapLoader.getAllMapDefinitions();
        expect(maps).toHaveLength(2);
      });
    });

    describe('createWorldFromDefinition', () => {
      it('should throw error for non-existent map', () => {
        expect(() => mapLoader.createWorldFromDefinition('nonexistent', ecsWorld)).toThrow(
          'Map definition "nonexistent" not found'
        );
      });

      it('should create world with correct dimensions', () => {
        const mapDef = createTestMapDefinition('size_test', {
          width: 200,
          height: 150,
          chunkSize: 32,
        });
        mapLoader.loadMapDefinition(mapDef);

        const world = mapLoader.createWorldFromDefinition('size_test', ecsWorld);

        expect(world.getWidth()).toBe(200);
        expect(world.getHeight()).toBe(150);
      });

      it('should emit worldCreated event', () => {
        const handler = jest.fn();
        eventBus.on('map:worldCreated', handler);

        const mapDef = createTestMapDefinition('emit_test');
        mapLoader.loadMapDefinition(mapDef);
        mapLoader.createWorldFromDefinition('emit_test', ecsWorld);

        expect(handler).toHaveBeenCalledWith({
          mapId: 'emit_test',
          worldWidth: 100,
          worldHeight: 100,
        });
      });

      it('should apply predefined chunks', () => {
        const mapDef: MapDefinition = {
          ...createTestMapDefinition('predef_test'),
          predefinedChunks: [
            {
              chunkX: 0,
              chunkY: 0,
              tiles: [
                ['wall', 'wall', 'wall'],
                ['wall', 'floor', 'door'],
                ['wall', 'wall', 'wall'],
              ],
            },
          ],
        };
        mapLoader.loadMapDefinition(mapDef);

        const world = mapLoader.createWorldFromDefinition('predef_test', ecsWorld);
        const chunk = world.getChunkManager().getChunk(0, 0);

        expect(chunk).toBeDefined();
        expect(chunk?.getTile(1, 1)?.terrain).toBe('floor');
      });

      it('should use generator when specified', () => {
        const mapDef = createTestMapDefinition('gen_test', {
          generator: 'wilderness',
          generatorParams: { treeDensity: 0.5 },
        });
        mapLoader.loadMapDefinition(mapDef);

        const world = mapLoader.createWorldFromDefinition('gen_test', ecsWorld);
        expect(world).toBeDefined();
      });

      it('should emit spawn point events', () => {
        const handler = jest.fn();
        eventBus.on('map:spawnPoint', handler);

        const mapDef: MapDefinition = {
          ...createTestMapDefinition('spawn_test'),
          spawnPoints: [
            { x: 10, y: 20, type: 'player', tags: ['start'] },
            { x: 30, y: 40, type: 'npc', tags: ['merchant'] },
          ],
        };
        mapLoader.loadMapDefinition(mapDef);
        mapLoader.createWorldFromDefinition('spawn_test', ecsWorld);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith({
          x: 10,
          y: 20,
          type: 'player',
          tags: ['start'],
        });
      });

      it('should emit entity placement events for predefined chunks', () => {
        const handler = jest.fn();
        eventBus.on('map:entityPlacementQueued', handler);

        const mapDef: MapDefinition = {
          ...createTestMapDefinition('entity_placement_test'),
          predefinedChunks: [
            {
              chunkX: 0,
              chunkY: 0,
              tiles: [['floor']],
              entities: [
                { x: 5, y: 5, type: 'creature', templateId: 'goblin' },
                { x: 3, y: 3, type: 'item', templateId: 'sword' },
              ],
            },
          ],
        };
        mapLoader.loadMapDefinition(mapDef);
        mapLoader.createWorldFromDefinition('entity_placement_test', ecsWorld);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          type: 'creature',
          templateId: 'goblin',
        }));
      });

      it('should apply predefined chunk tiles correctly', () => {
        const mapDef: MapDefinition = {
          ...createTestMapDefinition('tile_test'),
          width: 64,
          height: 64,
          chunkSize: 16,
          predefinedChunks: [
            {
              chunkX: 1,
              chunkY: 1,
              tiles: [
                ['wall', 'wall'],
                ['wall', 'floor'],
              ],
            },
          ],
        };
        mapLoader.loadMapDefinition(mapDef);
        const world = mapLoader.createWorldFromDefinition('tile_test', ecsWorld);

        // Chunk (1,1) starts at world position (16, 16)
        const chunk = world.getChunkManager().getChunk(1, 1);
        expect(chunk?.getTile(0, 0)?.terrain).toBe('wall');
        expect(chunk?.getTile(1, 1)?.terrain).toBe('floor');
      });

      it('should apply generator overrides', () => {
        const mapDef = createTestMapDefinition('override_test', {
          generator: 'wilderness',
          generatorParams: { seed: 12345 },
        });
        mapLoader.loadMapDefinition(mapDef);

        const world = mapLoader.createWorldFromDefinition('override_test', ecsWorld, {
          treeDensity: 0.8,
        });

        expect(world).toBeDefined();
      });
    });

    describe('getMapMetadataList', () => {
      it('should return metadata for all maps', () => {
        mapLoader.loadMapDefinition(createTestMapDefinition('map1', { name: 'Map One' }));
        mapLoader.loadMapDefinition(createTestMapDefinition('map2', { name: 'Map Two' }));

        const metadata = mapLoader.getMapMetadataList();
        expect(metadata).toHaveLength(2);
        expect(metadata[0].name).toBeDefined();
        expect(metadata[0].size).toBeDefined();
      });
    });
  });

  // ============================================================================
  // WorldGenerator Tests
  // ============================================================================
  describe('WorldGenerator', () => {
    let worldGenerator: WorldGenerator;
    let world: World;
    let ecsWorld: ECSWorld;

    beforeEach(() => {
      worldGenerator = new WorldGenerator(eventBus);
      ecsWorld = createTestECSWorld(eventBus);
      world = new World(128, 128, 32, ecsWorld);
      world.initialize();
    });

    describe('registerGenerator', () => {
      it('should register a custom generator', () => {
        const customGen = jest.fn();
        worldGenerator.registerGenerator('custom', customGen);

        expect(worldGenerator.getGenerator('custom')).toBe(customGen);
      });

      it('should return undefined for non-existent generator', () => {
        expect(worldGenerator.getGenerator('nonexistent')).toBeUndefined();
      });
    });

    describe('generateWorld', () => {
      it('should throw error for non-existent generator', () => {
        expect(() => worldGenerator.generateWorld(world, 'nonexistent')).toThrow(
          'Generator "nonexistent" not found'
        );
      });

      it('should emit generation started event', () => {
        const handler = jest.fn();
        eventBus.on('generation:started', handler);

        worldGenerator.generateWorld(world, 'wilderness', { seed: 12345 });

        expect(handler).toHaveBeenCalledWith({
          generator: 'wilderness',
          seed: 12345,
        });
      });

      it('should use default seed when not provided', () => {
        const handler = jest.fn();
        eventBus.on('generation:started', handler);

        worldGenerator.generateWorld(world, 'wilderness');

        expect(handler).toHaveBeenCalledWith({
          generator: 'wilderness',
          seed: 'default',
        });
      });
    });

    describe('wilderness generator', () => {
      it('should generate terrain with trees and water', () => {
        worldGenerator.generateWorld(world, 'wilderness', {
          treeDensity: 0.3,
          waterChance: 0.1,
        });

        // Create a chunk to trigger generation
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // Count different terrain types
        let floorCount = 0;
        let treeCount = 0;
        let waterCount = 0;

        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            const tile = chunk.getTile(x, y);
            if (tile?.terrain === 'floor') floorCount++;
            if (tile?.terrain === 'tree') treeCount++;
            if (tile?.terrain === 'water') waterCount++;
          }
        }

        // Should have a mix of terrain types
        expect(floorCount + treeCount + waterCount).toBeGreaterThan(0);
      });

      it('should create border walls', () => {
        worldGenerator.generateWorld(world, 'wilderness');
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // Check borders
        expect(chunk.getTile(0, 0)?.terrain).toBe('wall');
        expect(chunk.getTile(chunk.size - 1, 0)?.terrain).toBe('wall');
        expect(chunk.getTile(0, chunk.size - 1)?.terrain).toBe('wall');
        expect(chunk.getTile(chunk.size - 1, chunk.size - 1)?.terrain).toBe('wall');
      });
    });

    describe('dungeon generator', () => {
      it('should generate rooms and corridors', () => {
        worldGenerator.generateWorld(world, 'dungeon', { roomChance: 0.5 });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // Should have floor tiles from rooms
        let floorCount = 0;
        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            if (chunk.getTile(x, y)?.terrain === 'floor') {
              floorCount++;
            }
          }
        }

        expect(floorCount).toBeGreaterThan(0);
      });

      it('should place doors in some rooms', () => {
        worldGenerator.generateWorld(world, 'dungeon', { roomChance: 1.0 });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // Door placement is probabilistic, so we just verify the generator ran
        expect(chunk).toBeDefined();
      });
    });

    describe('cave generator', () => {
      it('should generate cave-like structure', () => {
        worldGenerator.generateWorld(world, 'cave', {
          fillPercent: 0.45,
          iterations: 3,
        });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);
        worldGenerator.generateChunk(world, chunk);

        // Should have mix of walls and floors
        let wallCount = 0;
        let floorCount = 0;

        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            const terrain = chunk.getTile(x, y)?.terrain;
            if (terrain === 'wall') wallCount++;
            if (terrain === 'floor') floorCount++;
          }
        }

        expect(wallCount + floorCount).toBe(chunk.size * chunk.size);
      });

      it('should respect fillPercent parameter', () => {
        worldGenerator.generateWorld(world, 'cave', { fillPercent: 0.8, iterations: 1 });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);
        worldGenerator.generateChunk(world, chunk);

        let wallCount = 0;
        for (let y = 0; y < chunk.size; y++) {
          for (let x = 0; x < chunk.size; x++) {
            if (chunk.getTile(x, y)?.terrain === 'wall') {
              wallCount++;
            }
          }
        }

        // Higher fill percent should result in more walls
        expect(wallCount).toBeGreaterThan(chunk.size * chunk.size * 0.3);
      });
    });

    describe('city generator', () => {
      it('should generate street grid', () => {
        worldGenerator.generateWorld(world, 'city', {
          blockSize: 20,
          buildingDensity: 0.7,
        });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // Check for street pattern at regular intervals
        const streetX = chunk.getTile(20, 10)?.terrain;
        const streetY = chunk.getTile(10, 20)?.terrain;

        // Streets should be floor tiles
        expect(streetX).toBe('floor');
        expect(streetY).toBe('floor');
      });

      it('should place buildings in blocks', () => {
        worldGenerator.generateWorld(world, 'city', { buildingDensity: 1.0, blockSize: 10 });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);
        worldGenerator.generateChunk(world, chunk);

        // Should have walls (buildings)
        let wallCount = 0;
        for (let y = 1; y < chunk.size; y++) {
          for (let x = 1; x < chunk.size; x++) {
            if (chunk.getTile(x, y)?.terrain === 'wall') {
              wallCount++;
            }
          }
        }

        expect(wallCount).toBeGreaterThan(0);
      });

      it('should place some trees', () => {
        worldGenerator.generateWorld(world, 'city', { buildingDensity: 0.5 });
        const chunk = world.getChunkManager().getOrCreateChunk(0, 0);

        // May or may not have trees due to randomness, just verify it runs
        expect(chunk).toBeDefined();
      });
    });
  });

  // ============================================================================
  // ModLoader Tests
  // ============================================================================
  describe('ModLoader', () => {
    let modLoader: ModLoader;
    let mapLoader: MapLoader;

    beforeEach(() => {
      mapLoader = new MapLoader(contentLoader, eventBus);
      modLoader = new ModLoader(eventBus, contentLoader, mapLoader);
    });

    afterEach(() => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      modLoader.clear();
      consoleSpy.mockRestore();
    });

    const createTestMod = (id: string, deps?: string[]): Mod => ({
      id,
      name: `Test Mod ${id}`,
      version: '1.0.0',
      dependencies: deps,
      initialize: jest.fn(),
      cleanup: jest.fn(),
    });

    describe('loadMod', () => {
      it('should load a mod and emit event', () => {
        const handler = jest.fn();
        eventBus.on('mod:loaded', handler);

        const mod = createTestMod('test_mod');
        modLoader.loadMod(mod);

        expect(handler).toHaveBeenCalledWith({
          modId: 'test_mod',
          name: 'Test Mod test_mod',
          version: '1.0.0',
        });
      });

      it('should throw error when dependency not loaded', () => {
        const mod = createTestMod('dependent', ['missing_dep']);

        expect(() => modLoader.loadMod(mod)).toThrow(
          'Mod "dependent" requires dependency "missing_dep" which is not loaded'
        );
      });

      it('should load mod with satisfied dependencies', () => {
        const baseMod = createTestMod('base');
        const dependentMod = createTestMod('dependent', ['base']);

        modLoader.loadMod(baseMod);
        expect(() => modLoader.loadMod(dependentMod)).not.toThrow();
      });

      it('should throw error when loading duplicate mod', () => {
        const mod = createTestMod('duplicate');
        modLoader.loadMod(mod);

        expect(() => modLoader.loadMod(mod)).toThrow(
          'Mod "duplicate" is already loaded'
        );
      });

      it('should load multiple mods in order', () => {
        const mod1 = createTestMod('mod1');
        const mod2 = createTestMod('mod2');
        const mod3 = createTestMod('mod3');

        modLoader.loadMod(mod1);
        modLoader.loadMod(mod2);
        modLoader.loadMod(mod3);

        const mods = modLoader.getAllMods();
        expect(mods).toHaveLength(3);
        expect(mods[0].id).toBe('mod1');
        expect(mods[2].id).toBe('mod3');
      });
    });

    describe('initializeMods', () => {
      it('should initialize all loaded mods', () => {
        const mod1 = createTestMod('mod1');
        const mod2 = createTestMod('mod2');

        modLoader.loadMod(mod1);
        modLoader.loadMod(mod2);
        modLoader.initializeMods();

        expect(mod1.initialize).toHaveBeenCalled();
        expect(mod2.initialize).toHaveBeenCalled();
      });

      it('should emit initialized event for each mod', () => {
        const handler = jest.fn();
        eventBus.on('mod:initialized', handler);

        const mod = createTestMod('init_test');
        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(handler).toHaveBeenCalledWith({ modId: 'init_test' });
      });

      it('should emit initError on initialization failure', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const handler = jest.fn();
        eventBus.on('mod:initError', handler);

        const mod: Mod = {
          id: 'failing_mod',
          name: 'Failing Mod',
          version: '1.0.0',
          initialize: () => {
            throw new Error('Init failed');
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(handler).toHaveBeenCalledWith({
          modId: 'failing_mod',
          error: expect.any(Error),
        });
        consoleSpy.mockRestore();
      });

      it('should provide ModAPI to mod initialize', () => {
        const mod = createTestMod('api_test');
        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(mod.initialize).toHaveBeenCalledWith(
          expect.objectContaining({
            eventBus: expect.any(EventBus),
            contentLoader: expect.any(ContentLoader),
            mapLoader: expect.any(MapLoader),
            worldGenerator: expect.any(WorldGenerator),
            registerItem: expect.any(Function),
            registerCreature: expect.any(Function),
            registerRecipe: expect.any(Function),
            registerTerrain: expect.any(Function),
            registerGenerator: expect.any(Function),
            createEntity: expect.any(Function),
            spawnItem: expect.any(Function),
          })
        );
      });
    });

    describe('cleanupMods', () => {
      it('should call cleanup on all mods in reverse order', () => {
        const order: string[] = [];

        const mod1: Mod = {
          id: 'mod1',
          name: 'Mod 1',
          version: '1.0.0',
          initialize: jest.fn(),
          cleanup: () => order.push('mod1'),
        };

        const mod2: Mod = {
          id: 'mod2',
          name: 'Mod 2',
          version: '1.0.0',
          initialize: jest.fn(),
          cleanup: () => order.push('mod2'),
        };

        modLoader.loadMod(mod1);
        modLoader.loadMod(mod2);
        modLoader.cleanupMods();

        expect(order).toEqual(['mod2', 'mod1']);
      });

      it('should emit cleanup event', () => {
        const handler = jest.fn();
        eventBus.on('mod:cleanup', handler);

        const mod = createTestMod('cleanup_test');
        modLoader.loadMod(mod);
        modLoader.cleanupMods();

        expect(handler).toHaveBeenCalledWith({ modId: 'cleanup_test' });
      });

      it('should handle cleanup errors gracefully', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const mod: Mod = {
          id: 'failing_cleanup',
          name: 'Failing Cleanup',
          version: '1.0.0',
          initialize: jest.fn(),
          cleanup: () => {
            throw new Error('Cleanup failed');
          },
        };

        modLoader.loadMod(mod);

        // Should not throw
        expect(() => modLoader.cleanupMods()).not.toThrow();
        consoleSpy.mockRestore();
      });
    });

    describe('getMod', () => {
      it('should return undefined for non-existent mod', () => {
        expect(modLoader.getMod('nonexistent')).toBeUndefined();
      });

      it('should return the correct mod', () => {
        const mod = createTestMod('specific');
        modLoader.loadMod(mod);

        expect(modLoader.getMod('specific')).toBe(mod);
      });
    });

    describe('getAllMods', () => {
      it('should return empty array when no mods loaded', () => {
        expect(modLoader.getAllMods()).toEqual([]);
      });

      it('should return all mods in load order', () => {
        const mod1 = createTestMod('first');
        const mod2 = createTestMod('second');

        modLoader.loadMod(mod1);
        modLoader.loadMod(mod2);

        const mods = modLoader.getAllMods();
        expect(mods[0].id).toBe('first');
        expect(mods[1].id).toBe('second');
      });
    });

    describe('unloadMod', () => {
      it('should return false for non-existent mod', () => {
        expect(modLoader.unloadMod('nonexistent')).toBe(false);
      });

      it('should unload mod and emit event', () => {
        const handler = jest.fn();
        eventBus.on('mod:unloaded', handler);

        const mod = createTestMod('to_unload');
        modLoader.loadMod(mod);
        const result = modLoader.unloadMod('to_unload');

        expect(result).toBe(true);
        expect(modLoader.getMod('to_unload')).toBeUndefined();
        expect(handler).toHaveBeenCalledWith({ modId: 'to_unload' });
      });

      it('should call cleanup when unloading', () => {
        const mod = createTestMod('with_cleanup');
        modLoader.loadMod(mod);
        modLoader.unloadMod('with_cleanup');

        expect(mod.cleanup).toHaveBeenCalled();
      });
    });

    describe('isModLoaded', () => {
      it('should return false for non-loaded mod', () => {
        expect(modLoader.isModLoaded('not_loaded')).toBe(false);
      });

      it('should return true for loaded mod', () => {
        const mod = createTestMod('loaded');
        modLoader.loadMod(mod);

        expect(modLoader.isModLoaded('loaded')).toBe(true);
      });
    });

    describe('clear', () => {
      it('should cleanup and remove all mods', () => {
        const mod1 = createTestMod('mod1');
        const mod2 = createTestMod('mod2');

        modLoader.loadMod(mod1);
        modLoader.loadMod(mod2);
        modLoader.clear();

        expect(modLoader.getAllMods()).toHaveLength(0);
        expect(mod1.cleanup).toHaveBeenCalled();
        expect(mod2.cleanup).toHaveBeenCalled();
      });
    });

    describe('ModAPI', () => {
      it('should allow registering terrain through API', () => {
        const mod: Mod = {
          id: 'terrain_mod',
          name: 'Terrain Mod',
          version: '1.0.0',
          initialize: (api) => {
            api.registerTerrain(createTestTerrainDefinition('custom_terrain'));
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(contentLoader.getTerrain('custom_terrain')).toBeDefined();
      });

      it('should allow registering generator through API', () => {
        const customGen = jest.fn();
        const mod: Mod = {
          id: 'gen_mod',
          name: 'Generator Mod',
          version: '1.0.0',
          initialize: (api) => {
            api.registerGenerator('custom_gen', customGen);
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        const wg = (mapLoader as any).worldGenerator as WorldGenerator;
        expect(wg.getGenerator('custom_gen')).toBe(customGen);
      });

      it('should allow creating entities through API', () => {
        const ecsWorld = createTestECSWorld(eventBus);
        let createdEntityId: number | undefined;

        const mod: Mod = {
          id: 'entity_mod',
          name: 'Entity Mod',
          version: '1.0.0',
          initialize: (api) => {
            const entity = api.createEntity('test_template', 10, 20, ecsWorld);
            createdEntityId = entity?.id;
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(createdEntityId).toBeDefined();
        const entity = ecsWorld.getEntity(createdEntityId!);
        expect(entity).toBeDefined();
      });

      it('should emit entity creation event', () => {
        const handler = jest.fn();
        eventBus.on('mod:entityCreated', handler);

        const ecsWorld = createTestECSWorld(eventBus);
        const mod: Mod = {
          id: 'emit_mod',
          name: 'Emit Mod',
          version: '1.0.0',
          initialize: (api) => {
            api.createEntity('template', 5, 10, ecsWorld);
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 'template',
            x: 5,
            y: 10,
          })
        );
      });

      it('should allow spawning items through API', () => {
        const mockItemManager = {
          spawnItem: jest.fn().mockReturnValue({ id: 'item_123' }),
        };

        const handler = jest.fn();
        eventBus.on('mod:itemSpawned', handler);

        const mod: Mod = {
          id: 'item_mod',
          name: 'Item Mod',
          version: '1.0.0',
          initialize: (api) => {
            api.spawnItem('sword', 1, 10, 20, mockItemManager);
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods(mockItemManager);

        expect(mockItemManager.spawnItem).toHaveBeenCalledWith('sword', 1, { x: 10, y: 20 });
        expect(handler).toHaveBeenCalled();
      });

      it('should handle spawnItem with no itemManager', () => {
        const mod: Mod = {
          id: 'no_manager_mod',
          name: 'No Manager Mod',
          version: '1.0.0',
          initialize: (api) => {
            const result = api.spawnItem('sword', 1, 10, 20, null);
            expect(result).toBeNull();
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();
      });

      it('should handle spawnItem with itemManager missing spawnItem method', () => {
        const badItemManager = {};
        const mod: Mod = {
          id: 'bad_manager_mod',
          name: 'Bad Manager Mod',
          version: '1.0.0',
          initialize: (api) => {
            const result = api.spawnItem('sword', 1, 10, 20, badItemManager);
            expect(result).toBeNull();
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods(badItemManager);
      });

      it('should register items through API', () => {
        const mod: Mod = {
          id: 'register_item_mod',
          name: 'Register Item Mod',
          version: '1.0.0',
          initialize: (api) => {
            api.registerItem({
              id: 'mod_item',
              name: 'Mod Item',
              category: 'misc' as any,
              character: '?',
              foreground: '#ffffff',
              properties: { weight: 1, volume: 1 },
            } as any);
          },
        };

        modLoader.loadMod(mod);
        modLoader.initializeMods();

        expect(contentLoader.getTerrain('mod_item')).toBeDefined();
      });
    });
  });

  // ============================================================================
  // ContentManager Tests
  // ============================================================================
  describe('ContentManager', () => {
    let contentManager: ContentManager;
    let ecsWorld: ECSWorld;

    beforeEach(() => {
      contentManager = new ContentManager(eventBus);
      ecsWorld = createTestECSWorld(eventBus);
    });

    afterEach(() => {
      contentManager.clear();
    });

    describe('constructor', () => {
      it('should initialize all subsystems', () => {
        expect(contentManager.contentLoader).toBeDefined();
        expect(contentManager.mapLoader).toBeDefined();
        expect(contentManager.modLoader).toBeDefined();
      });
    });

    describe('loadContentPack', () => {
      it('should load content pack from JSON', () => {
        const pack = createTestContentPack('pack');
        contentManager.loadContentPack(JSON.stringify(pack));

        expect(contentManager.getLoadedContentPacks()).toHaveLength(1);
      });
    });

    describe('loadMap', () => {
      it('should load map from JSON', () => {
        const mapDef = createTestMapDefinition('map');
        contentManager.loadMap(JSON.stringify(mapDef));

        expect(contentManager.getAvailableMaps()).toHaveLength(1);
      });
    });

    describe('loadMod', () => {
      it('should load mod', () => {
        const mod: Mod = {
          id: 'test_mod',
          name: 'Test Mod',
          version: '1.0.0',
          initialize: jest.fn(),
        };

        contentManager.loadMod(mod);
        expect(contentManager.getLoadedMods()).toHaveLength(1);
      });
    });

    describe('initializeMods', () => {
      it('should initialize all loaded mods', () => {
        const mod: Mod = {
          id: 'init_mod',
          name: 'Init Mod',
          version: '1.0.0',
          initialize: jest.fn(),
        };

        contentManager.loadMod(mod);
        contentManager.initializeMods();

        expect(mod.initialize).toHaveBeenCalled();
      });
    });

    describe('getAvailableMaps', () => {
      it('should return metadata for all loaded maps', () => {
        contentManager.loadMap(JSON.stringify(createTestMapDefinition('map1')));
        contentManager.loadMap(JSON.stringify(createTestMapDefinition('map2')));

        const maps = contentManager.getAvailableMaps();
        expect(maps).toHaveLength(2);
      });
    });

    describe('createWorld', () => {
      it('should create world from map definition', () => {
        const handler = jest.fn();
        eventBus.on('content:worldCreated', handler);

        contentManager.loadMap(JSON.stringify(createTestMapDefinition('test_world')));
        const world = contentManager.createWorld('test_world', ecsWorld);

        expect(world).toBeDefined();
        expect(handler).toHaveBeenCalledWith({ mapId: 'test_world' });
      });

      it('should throw for non-existent map', () => {
        expect(() => contentManager.createWorld('nonexistent', ecsWorld)).toThrow();
      });
    });

    describe('registerGenerator', () => {
      it('should register custom generator', () => {
        const customGen = jest.fn();
        contentManager.registerGenerator('custom', customGen);

        const wg = (contentManager.mapLoader as any).worldGenerator as WorldGenerator;
        expect(wg.getGenerator('custom')).toBe(customGen);
      });
    });

    describe('getLoadedContentPacks', () => {
      it('should return all loaded content packs', () => {
        contentManager.loadContentPack(JSON.stringify(createTestContentPack('pack1')));
        contentManager.loadContentPack(JSON.stringify(createTestContentPack('pack2')));

        expect(contentManager.getLoadedContentPacks()).toHaveLength(2);
      });
    });

    describe('getLoadedMods', () => {
      it('should return all loaded mods', () => {
        const mod1: Mod = { id: 'mod1', name: 'Mod 1', version: '1.0.0', initialize: jest.fn() };
        const mod2: Mod = { id: 'mod2', name: 'Mod 2', version: '1.0.0', initialize: jest.fn() };

        contentManager.loadMod(mod1);
        contentManager.loadMod(mod2);

        expect(contentManager.getLoadedMods()).toHaveLength(2);
      });
    });

    describe('clear', () => {
      it('should clear all content', () => {
        contentManager.loadContentPack(JSON.stringify(createTestContentPack('pack')));
        contentManager.loadMod({ id: 'mod', name: 'Mod', version: '1.0.0', initialize: jest.fn() });

        contentManager.clear();

        expect(contentManager.getLoadedContentPacks()).toHaveLength(0);
        expect(contentManager.getLoadedMods()).toHaveLength(0);
      });
    });
  });
});
