/**
 * Main Engine class
 * Coordinates all systems and runs the game loop
 */

import { EventBus, globalEventBus } from './EventBus';
import { Config } from './Config';

export class Engine {
  private eventBus: EventBus;
  private config: Config;
  private isRunning: boolean = false;

  constructor() {
    this.eventBus = globalEventBus;
    this.config = Config.getInstance();
  }

  async initialize(): Promise<void> {
    console.log('ASCII World Engine initializing...');
    console.log(`World size: ${this.config.world.width}x${this.config.world.height}`);
    console.log(`Chunk size: ${this.config.world.chunkSize}x${this.config.world.chunkSize}`);
    
    this.eventBus.emit('engine:initialized', { version: '0.1.0' });
  }

  start(): void {
    this.isRunning = true;
    console.log('Engine started');
    this.eventBus.emit('engine:started', {});
  }

  stop(): void {
    this.isRunning = false;
    console.log('Engine stopped');
    this.eventBus.emit('engine:stopped', {});
  }

  get running(): boolean {
    return this.isRunning;
  }
}
