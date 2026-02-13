/**
 * Crosshair Renderer
 * Renders a highlighted box around the look cursor position
 * Highlights the surrounding 8 tiles with a yellow background
 */

import { LookMode } from '../../interaction/LookMode';
import { DisplayManager } from '../index';
import { Camera } from '../index';
import { World } from '../../world';
import { ECSWorld } from '../../ecs';
import { FOVSystem } from '../../physics';
import { ItemManager } from '../../items';

export interface CrosshairConfig {
  highlightBgColor: string; // Background color for highlighted surrounding tiles
}

export const DEFAULT_CROSSHAIR_CONFIG: CrosshairConfig = {
  highlightBgColor: '#444400', // Dark yellow background for highlighting
};

export class CrosshairRenderer {
  private lookMode: LookMode;
  private displayManager: DisplayManager;
  private camera: Camera;
  private world: World;
  private ecsWorld: ECSWorld;
  private fovSystem: FOVSystem;
  private itemManager: ItemManager;
  private config: CrosshairConfig;

  constructor(
    lookMode: LookMode,
    displayManager: DisplayManager,
    camera: Camera,
    world: World,
    ecsWorld: ECSWorld,
    fovSystem: FOVSystem,
    itemManager: ItemManager,
    config: Partial<CrosshairConfig> = {}
  ) {
    this.lookMode = lookMode;
    this.displayManager = displayManager;
    this.camera = camera;
    this.world = world;
    this.ecsWorld = ecsWorld;
    this.fovSystem = fovSystem;
    this.itemManager = itemManager;
    this.config = { ...DEFAULT_CROSSHAIR_CONFIG, ...config };
  }

  /**
   * Render the crosshair/highlight box at the look cursor position
   * Highlights the 8 surrounding tiles with a colored background
   */
  render(): void {
    if (!this.lookMode.isEnabled()) return;

    const cursorPos = this.lookMode.getCursorPosition();

    // Check if cursor is in viewport
    if (!this.camera.isInViewport(cursorPos.x, cursorPos.y)) return;

    const screenPos = this.camera.worldToScreen(cursorPos.x, cursorPos.y);
    if (!screenPos) return;

    const { highlightBgColor } = this.config;

    // Define the 8 surrounding positions (box outline)
    const z = cursorPos.z ?? 0;
    const surroundingPositions = [
      { screenX: screenPos.x - 1, screenY: screenPos.y - 1, worldX: cursorPos.x - 1, worldY: cursorPos.y - 1 }, // top-left
      { screenX: screenPos.x, screenY: screenPos.y - 1, worldX: cursorPos.x, worldY: cursorPos.y - 1 },     // top
      { screenX: screenPos.x + 1, screenY: screenPos.y - 1, worldX: cursorPos.x + 1, worldY: cursorPos.y - 1 }, // top-right
      { screenX: screenPos.x - 1, screenY: screenPos.y, worldX: cursorPos.x - 1, worldY: cursorPos.y },     // left
      { screenX: screenPos.x + 1, screenY: screenPos.y, worldX: cursorPos.x + 1, worldY: cursorPos.y },     // right
      { screenX: screenPos.x - 1, screenY: screenPos.y + 1, worldX: cursorPos.x - 1, worldY: cursorPos.y + 1 }, // bottom-left
      { screenX: screenPos.x, screenY: screenPos.y + 1, worldX: cursorPos.x, worldY: cursorPos.y + 1 },     // bottom
      { screenX: screenPos.x + 1, screenY: screenPos.y + 1, worldX: cursorPos.x + 1, worldY: cursorPos.y + 1 }, // bottom-right
    ];

    // Highlight each surrounding tile
    for (const pos of surroundingPositions) {
      this.highlightTile(pos.screenX, pos.screenY, pos.worldX, pos.worldY, z, highlightBgColor);
    }
  }

  /**
   * Highlight a tile by redrawing it with a highlighted background
   */
  private highlightTile(
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number,
    worldZ: number,
    highlightBg: string
  ): void {
    // Check if position is in viewport
    if (!this.camera.isInViewport(worldX, worldY)) return;

    // Check visibility
    const isVisible = this.fovSystem.isVisible(worldX, worldY);
    const isExplored = this.fovSystem.isExplored(worldX, worldY);

    if (!isVisible && !isExplored) {
      // Position is unknown, don't highlight
      return;
    }

    // Get the tile at this position
    const tile = this.world.getTileAt(worldX, worldY, worldZ);

    // Get entities at this position
    const entities = this.ecsWorld.queryEntities({ all: ['position', 'renderable'] }).filter(entity => {
      const pos = entity.getComponent<{ type: 'position'; x: number; y: number; z: number }>('position');
      return pos && pos.x === worldX && pos.y === worldY && pos.z === worldZ;
    });

    // Get items at this position
    const items = this.itemManager.getItemsAt(this.ecsWorld, { x: worldX, y: worldY, z: worldZ });

    // Determine what to draw
    let char = tile?.char ?? '.';
    let fg = tile?.fg ?? '#888888';
    let bg = highlightBg;

    // If visible and there are entities, draw the top entity
    if (isVisible && entities.length > 0) {
      const entity = entities[0];
      const renderable = entity.getComponent<{ type: 'renderable'; char: string; fg: string; bg?: string }>('renderable');
      if (renderable) {
        char = renderable.char;
        fg = renderable.fg;
      }
    }
    // If visible and there are items, draw the top item
    else if (isVisible && items.length > 0) {
      const item = items[0];
      const renderable = item.getComponent<{ type: 'renderable'; char: string; fg: string; bg?: string }>('renderable');
      if (renderable) {
        char = renderable.char;
        fg = renderable.fg;
      }
    }

    // If not visible but explored, dim the colors
    if (!isVisible && isExplored) {
      fg = this.dimColor(fg);
    }

    // Draw the tile/entity with highlighted background
    this.displayManager.draw(screenX, screenY, char, fg, bg);
  }

  /**
   * Dim a color for explored but not currently visible tiles
   */
  private dimColor(color: string): string {
    // Simple dimming: reduce brightness by converting to grayscale-ish
    // For now, just return a darker version
    // This is a simplified approach - in production you might want more sophisticated color manipulation
    if (color.startsWith('#')) {
      // Parse hex color and darken it
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const dimR = Math.floor(r * 0.5);
      const dimG = Math.floor(g * 0.5);
      const dimB = Math.floor(b * 0.5);

      return `#${dimR.toString(16).padStart(2, '0')}${dimG.toString(16).padStart(2, '0')}${dimB.toString(16).padStart(2, '0')}`;
    }
    return color;
  }

  /**
   * Update crosshair configuration
   */
  setConfig(config: Partial<CrosshairConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CrosshairConfig {
    return { ...this.config };
  }
}

export default CrosshairRenderer;
