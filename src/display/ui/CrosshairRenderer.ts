/**
 * Crosshair Renderer
 * Renders a highlighted box around the look cursor position
 */

import { LookMode } from '../../interaction/LookMode';
import { DisplayManager } from '../index';
import { Camera } from '../index';

export interface CrosshairConfig {
  fgColor: string;
  bgColor: string;
  boxChars: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
  };
}

export const DEFAULT_CROSSHAIR_CONFIG: CrosshairConfig = {
  fgColor: '#ffff00', // Yellow
  bgColor: '#444444', // Dark gray background
  boxChars: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│'
  }
};

export class CrosshairRenderer {
  private lookMode: LookMode;
  private displayManager: DisplayManager;
  private camera: Camera;
  private config: CrosshairConfig;

  constructor(
    lookMode: LookMode,
    displayManager: DisplayManager,
    camera: Camera,
    config: Partial<CrosshairConfig> = {}
  ) {
    this.lookMode = lookMode;
    this.displayManager = displayManager;
    this.camera = camera;
    this.config = { ...DEFAULT_CROSSHAIR_CONFIG, ...config };
  }

  /**
   * Render the crosshair/highlight box at the look cursor position
   */
  render(): void {
    if (!this.lookMode.isEnabled()) return;

    const cursorPos = this.lookMode.getCursorPosition();
    
    // Check if cursor is in viewport
    if (!this.camera.isInViewport(cursorPos.x, cursorPos.y)) return;

    const screenPos = this.camera.worldToScreen(cursorPos.x, cursorPos.y);
    if (!screenPos) return;

    const { fgColor, bgColor, boxChars } = this.config;

    // Draw box around the tile
    // Top left
    this.displayManager.draw(
      screenPos.x - 1, 
      screenPos.y - 1, 
      boxChars.topLeft, 
      fgColor, 
      bgColor
    );
    
    // Top right
    this.displayManager.draw(
      screenPos.x + 1, 
      screenPos.y - 1, 
      boxChars.topRight, 
      fgColor, 
      bgColor
    );
    
    // Bottom left
    this.displayManager.draw(
      screenPos.x - 1, 
      screenPos.y + 1, 
      boxChars.bottomLeft, 
      fgColor, 
      bgColor
    );
    
    // Bottom right
    this.displayManager.draw(
      screenPos.x + 1, 
      screenPos.y + 1, 
      boxChars.bottomRight, 
      fgColor, 
      bgColor
    );
    
    // Top horizontal
    this.displayManager.draw(
      screenPos.x, 
      screenPos.y - 1, 
      boxChars.horizontal, 
      fgColor, 
      bgColor
    );
    
    // Bottom horizontal
    this.displayManager.draw(
      screenPos.x, 
      screenPos.y + 1, 
      boxChars.horizontal, 
      fgColor, 
      bgColor
    );
    
    // Left vertical
    this.displayManager.draw(
      screenPos.x - 1, 
      screenPos.y, 
      boxChars.vertical, 
      fgColor, 
      bgColor
    );
    
    // Right vertical
    this.displayManager.draw(
      screenPos.x + 1, 
      screenPos.y, 
      boxChars.vertical, 
      fgColor, 
      bgColor
    );

    // Highlight the center tile with inverted colors
    // We need to get what's currently drawn there and invert it
    // For now, just draw a highlight indicator
    const visibility = this.lookMode.getVisibilityStatus();
    const centerChar = visibility === 'visible' ? '·' : 
                      visibility === 'explored' ? '·' : '?';
    
    this.displayManager.draw(
      screenPos.x, 
      screenPos.y, 
      centerChar, 
      '#ffffff', 
      '#666666'
    );
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
