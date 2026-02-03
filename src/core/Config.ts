/**
 * Configuration management
 */

import { WORLD_DEFAULTS } from '../config/WorldDefaults';
import { ACTION_COSTS } from '../config/ActionCosts';

export interface GameConfig {
  world: typeof WORLD_DEFAULTS;
  actions: typeof ACTION_COSTS;
  debug: boolean;
}

export class Config {
  private static instance: Config;
  private _config: GameConfig;

  private constructor() {
    this._config = {
      world: WORLD_DEFAULTS,
      actions: ACTION_COSTS,
      debug: false
    };
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  get world() {
    return this._config.world;
  }

  get actions() {
    return this._config.actions;
  }

  get debug() {
    return this._config.debug;
  }

  set debug(value: boolean) {
    this._config.debug = value;
  }
}
