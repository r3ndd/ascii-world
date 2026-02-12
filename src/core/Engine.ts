/**
 * Main Engine class
 * Coordinates all systems and runs the game loop
 */

import { EventBus, globalEventBus } from './EventBus';
import { Config } from './Config';
import { ECSWorld, Entity } from '../ecs';
import { EntityFactory, PlayerOptions, NPCOptions } from '../ecs/EntityFactory';
import { DisplayManager, DisplayConfig, Camera, Renderer } from '../display';
import { MapManager, World } from '../world';
import { TurnManager, SpeedSystem, ActorSystem } from '../time';
import { PhysicsSystem, FOVSystem, Pathfinding } from '../physics';
import { Direction } from './Types';
import { LookMode, DEFAULT_LOOK_MODE_CONFIG } from '../interaction';
import { LookPanel, CrosshairRenderer } from '../display/ui';
import { ItemManager } from '../items';

export interface EngineConfig {
  display: DisplayConfig;
  playerStartPosition?: { x: number; y: number; z?: number };
  fovRadius?: number;
}

export interface UIConfig {
  showTurnCounter?: boolean;
  showPosition?: boolean;
  showHealth?: boolean;
  customLines?: { x: number; y: number; text: string }[];
}

export class Engine {
  // Core systems
  private eventBus: EventBus;
  private config: Config;
  private isRunning: boolean = false;
  
  // Display
  public displayManager!: DisplayManager;
  public camera!: Camera;
  public renderer!: Renderer;
  
  // ECS
  public ecsWorld!: ECSWorld;
  
  // World
  public mapManager!: MapManager;
  public world!: World;
  
  // Turn management
  public turnManager!: TurnManager;
  public speedSystem!: SpeedSystem;
  public actorSystem!: ActorSystem;
  
  // Physics & FOV
  public physicsSystem!: PhysicsSystem;
  public fovSystem!: FOVSystem;
  public pathfinding!: Pathfinding;

  // Item management
  public itemManager!: ItemManager;

  // Look mode
  public lookMode!: LookMode;
  public lookPanel!: LookPanel;
  public crosshairRenderer!: CrosshairRenderer;
  private isInLookMode: boolean = false;

  // Configuration
  private engineConfig: EngineConfig;
  private playerEntity: Entity | null = null;
  private uiConfig: UIConfig = {
    showTurnCounter: true,
    showPosition: true,
    showHealth: true
  };

  constructor(engineConfig: EngineConfig) {
    this.eventBus = globalEventBus;
    this.config = Config.getInstance();
    this.engineConfig = engineConfig;
  }

  async initialize(): Promise<void> {
    console.log('ASCII World Engine initializing...');
    
    // Setup ECS
    this.ecsWorld = new ECSWorld(this.eventBus);
    this.ecsWorld.start();
    
    // Setup display
    this.displayManager = new DisplayManager(this.engineConfig.display);
    
    // Setup world
    this.mapManager = new MapManager(this.ecsWorld);
    this.world = this.mapManager.createDefaultWorld();
    
    // Setup camera
    this.camera = new Camera(
      { width: this.engineConfig.display.width, height: this.engineConfig.display.height },
      { width: this.world.getWidth(), height: this.world.getHeight() }
    );
    
    // Setup renderer
    this.renderer = new Renderer(this.displayManager, this.camera, this.ecsWorld);
    
    // Setup physics & FOV
    this.physicsSystem = new PhysicsSystem(this.world, this.ecsWorld, this.eventBus);
    this.fovSystem = new FOVSystem(this.world);
    this.renderer.setFOVSystem(this.fovSystem);

    // Setup pathfinding
    this.pathfinding = new Pathfinding(this.world);

    // Setup item management
    this.itemManager = new ItemManager(this.eventBus);

    // Setup look mode
    this.lookMode = new LookMode(
      this.world,
      this.fovSystem,
      this.itemManager,
      this.physicsSystem,
      this.ecsWorld,
      this.eventBus,
      this.pathfinding,
      DEFAULT_LOOK_MODE_CONFIG
    );

    // Setup look mode UI
    const sidebarWidth = DEFAULT_LOOK_MODE_CONFIG.sidebarWidth;
    const gameWidth = this.engineConfig.display.width - sidebarWidth;
    this.lookPanel = new LookPanel(
      this.lookMode,
      this.displayManager,
      this.camera,
      this.eventBus,
      { sidebarWidth, startX: gameWidth }
    );

    this.crosshairRenderer = new CrosshairRenderer(
      this.lookMode,
      this.displayManager,
      this.camera
    );

    // Setup turn management
    this.speedSystem = new SpeedSystem();
    this.actorSystem = new ActorSystem(this.ecsWorld, this.physicsSystem);
    this.ecsWorld.addSystem(this.actorSystem);

    this.turnManager = new TurnManager(
      this.ecsWorld,
      this.eventBus,
      this.speedSystem,
      this.actorSystem
    );

    // Setup default input handler
    this.setupDefaultInputHandler();
    
    console.log(`World size: ${this.config.world.width}x${this.config.world.height}`);
    console.log(`Chunk size: ${this.config.world.chunkSize}x${this.config.world.chunkSize}`);
    
    this.eventBus.emit('engine:initialized', { version: '0.1.0' });
  }

  private setupDefaultInputHandler(): void {
    let resolveInput: ((value: { direction?: Direction; wait?: boolean }) => void) | null = null;

    // Store current input promise resolver
    this.turnManager.setPlayerInputHandler(() => {
      return new Promise((resolve) => {
        resolveInput = resolve;
      });
    });

    // Keyboard handler
    document.addEventListener('keydown', (e) => {
      // Handle look mode
      if (this.isInLookMode) {
        this.handleLookModeInput(e);
        return;
      }

      if (!resolveInput) return;

      let direction: Direction | undefined;
      let wait = false;

      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          direction = 'north';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          direction = 'south';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          direction = 'west';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          direction = 'east';
          break;
        case ' ':
          wait = true;
          break;
        case 'l':
        case 'L':
        case 'x':
        case 'X':
          // Enter look mode
          e.preventDefault();
          if (this.playerEntity) {
            this.enterLookMode();
          }
          return;
        default:
          return; // Not a game key, ignore
      }

      e.preventDefault();
      resolveInput({ direction, wait });
      resolveInput = null;
    });
  }

  /**
   * Enter look mode
   */
  private enterLookMode(): void {
    if (!this.playerEntity) return;

    if (this.lookMode.enter(this.playerEntity)) {
      this.isInLookMode = true;
      this.render(); // Re-render to show look UI
    }
  }

  /**
   * Exit look mode
   */
  private exitLookMode(): void {
    this.lookMode.exit();
    this.isInLookMode = false;
    this.render(); // Re-render to hide look UI
  }

  /**
   * Handle keyboard input when in look mode
   */
  private handleLookModeInput(e: KeyboardEvent): void {
    e.preventDefault();

    switch(e.key) {
      case 'Escape':
        this.exitLookMode();
        return;
      case 'ArrowUp':
        this.lookMode.moveCursor('north');
        this.render();
        return;
      case 'ArrowDown':
        this.lookMode.moveCursor('south');
        this.render();
        return;
      case 'ArrowLeft':
        this.lookMode.moveCursor('west');
        this.render();
        return;
      case 'ArrowRight':
        this.lookMode.moveCursor('east');
        this.render();
        return;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        // Execute action by number
        const actionNumber = parseInt(e.key, 10);
        this.executeLookAction(actionNumber);
        return;
      case 'l':
      case 'L':
        this.executeLookActionByHotkey('l');
        return;
      case 'e':
      case 'E':
        this.executeLookActionByHotkey('e');
        return;
      case 'g':
      case 'G':
        this.executeLookActionByHotkey('g');
        return;
      case 'o':
      case 'O':
        this.executeLookActionByHotkey('o');
        return;
      case 'c':
      case 'C':
        this.executeLookActionByHotkey('c');
        return;
      case 'u':
      case 'U':
        this.executeLookActionByHotkey('u');
        return;
      case 'm':
      case 'M':
        this.executeLookActionByHotkey('m');
        return;
    }
  }

  /**
   * Execute a look mode action by its number
   */
  private async executeLookAction(actionNumber: number): Promise<void> {
    const shouldExit = await this.lookMode.executeActionByNumber(actionNumber);
    if (shouldExit) {
      this.exitLookMode();
    } else {
      this.render();
    }
  }

  /**
   * Execute a look mode action by its hotkey
   */
  private async executeLookActionByHotkey(hotkey: string): Promise<void> {
    const shouldExit = await this.lookMode.executeActionByHotkey(hotkey);
    if (shouldExit) {
      this.exitLookMode();
    } else {
      this.render();
    }
  }

  createPlayer(options: PlayerOptions = {}): Entity {
    // Use configured start position if not specified
    if (!options.position && this.engineConfig.playerStartPosition) {
      options.position = {
        x: this.engineConfig.playerStartPosition.x,
        y: this.engineConfig.playerStartPosition.y,
        z: this.engineConfig.playerStartPosition.z ?? 0
      };
    }
    
    this.playerEntity = EntityFactory.createPlayer(this.ecsWorld, options);
    
    // Register with turn manager
    this.turnManager.scanForNewActors();
    
    // Update camera to follow player
    const pos = this.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (pos) {
      this.camera.setPosition(pos.x, pos.y);
    }
    
    return this.playerEntity;
  }

  createNPC(options: NPCOptions = {}): Entity {
    const entity = EntityFactory.createNPC(this.ecsWorld, options);
    // Register with turn manager
    this.turnManager.scanForNewActors();
    return entity;
  }

  setUIConfig(config: UIConfig): void {
    this.uiConfig = { ...this.uiConfig, ...config };
  }

  render(): void {
    if (!this.playerEntity) {
      console.warn('No player entity set, cannot render');
      return;
    }

    const playerPos = this.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
    if (!playerPos) return;

    // Update camera to follow player
    this.camera.setPosition(playerPos.x, playerPos.y);

    // Update FOV
    const fovRadius = this.engineConfig.fovRadius ?? 15;
    this.fovSystem.computeFOV(playerPos.x, playerPos.y, fovRadius);

    // Clear display
    this.displayManager.clear();

    // Render visible terrain
    const viewport = this.camera.getViewportSize();

    for (let y = 0; y < viewport.height; y++) {
      for (let x = 0; x < viewport.width; x++) {
        const worldPos = this.camera.screenToWorld(x, y);
        if (this.fovSystem.isVisible(worldPos.x, worldPos.y)) {
          const tile = this.world.getTileAt(worldPos.x, worldPos.y);
          if (tile) {
            const char = tile.char ?? '?';
            const fg = tile.fg ?? '#fff';
            const bg = tile.bg ?? '#000';
            this.displayManager.draw(x, y, char, fg, bg);
          }
        } else if (this.fovSystem.isExplored(worldPos.x, worldPos.y)) {
          // Show explored but darker
          const tile = this.world.getTileAt(worldPos.x, worldPos.y);
          if (tile) {
            const char = tile.char ?? '?';
            this.displayManager.draw(x, y, char, '#444', '#000');
          }
        }
      }
    }

    // Render entities
    this.renderer.render();

    // Render look mode crosshair if active
    if (this.isInLookMode) {
      this.crosshairRenderer.render();
    }

    // Render UI
    this.renderUI();

    // Render look panel if active
    if (this.isInLookMode) {
      this.lookPanel.render();
    }
  }

  private renderUI(): void {
    // Don't render standard UI when in look mode to avoid overlap
    if (this.isInLookMode) {
      return;
    }

    const lines: { x: number; y: number; text: string }[] = [];

    if (this.uiConfig.showTurnCounter) {
      lines.push({ x: 1, y: 0, text: `Turn: ${this.turnManager.getCurrentTurn()}` });
    }

    if (this.uiConfig.showPosition && this.playerEntity) {
      const pos = this.playerEntity.getComponent<{ type: 'position'; x: number; y: number }>('position');
      if (pos) {
        const existingLine = lines.find(l => l.y === 0);
        if (existingLine) {
          existingLine.text += ` | Pos: (${pos.x}, ${pos.y})`;
        } else {
          lines.push({ x: 1, y: 0, text: `Pos: (${pos.x}, ${pos.y})` });
        }
      }
    }

    if (this.uiConfig.showHealth && this.playerEntity) {
      const health = this.playerEntity.getComponent<{ type: 'health'; current: number; max: number }>('health');
      if (health) {
        const viewport = this.camera.getViewportSize();
        lines.push({ x: 1, y: viewport.height - 1, text: `HP: ${health.current}/${health.max}` });
      }
    }

    // Add look mode hint
    lines.push({ x: 1, y: 1, text: 'Press L or X to look around' });

    // Add custom lines
    if (this.uiConfig.customLines) {
      lines.push(...this.uiConfig.customLines);
    }

    // Draw all UI lines
    for (const line of lines) {
      this.displayManager.drawText(line.x, line.y, line.text);
    }
  }

  getContainer(): HTMLElement | null {
    return this.displayManager.getContainer();
  }

  start(): void {
    this.isRunning = true;
    
    // Setup render on turn end to ensure we render after each action completes
    this.eventBus.on('turn:end', () => {
      this.render();
    });
    
    // Initial render
    this.render();
    
    // Start turn manager
    this.turnManager.start();
    
    console.log('Engine started');
    this.eventBus.emit('engine:started', {});
  }

  stop(): void {
    this.isRunning = false;
    this.turnManager.stop();
    console.log('Engine stopped');
    this.eventBus.emit('engine:stopped', {});
  }

  get running(): boolean {
    return this.isRunning;
  }

  getPlayerEntity(): Entity | null {
    return this.playerEntity;
  }
}
