/**
 * Look Panel UI Component
 * Renders a sidebar with tile information and contextual actions
 * CDDA-style interface
 */

import { LookMode } from '../../interaction/LookMode';
import { DisplayManager } from '../index';
import { Camera } from '../index';
import { Entity } from '../../ecs';

export interface LookPanelConfig {
  sidebarWidth: number;
  startX: number; // Starting column for the sidebar
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  highlightColor: string;
  dimColor: string;
}

export const DEFAULT_LOOK_PANEL_CONFIG: LookPanelConfig = {
  sidebarWidth: 20,
  startX: 60, // Assuming 80-column display, sidebar starts at column 60
  backgroundColor: '#000000',
  borderColor: '#444444',
  textColor: '#cccccc',
  highlightColor: '#ffff00',
  dimColor: '#666666'
};

export class LookPanel {
  private lookMode: LookMode;
  private displayManager: DisplayManager;
  private camera: Camera;
  private config: LookPanelConfig;

  constructor(
    lookMode: LookMode,
    displayManager: DisplayManager,
    camera: Camera,
    config: Partial<LookPanelConfig> = {}
  ) {
    this.lookMode = lookMode;
    this.displayManager = displayManager;
    this.camera = camera;
    this.config = { ...DEFAULT_LOOK_PANEL_CONFIG, ...config };
  }

  /**
   * Render the look panel sidebar
   */
  render(): void {
    if (!this.lookMode.isEnabled()) return;

    const { sidebarWidth, startX, backgroundColor, borderColor, textColor, highlightColor, dimColor } = this.config;
    const viewportHeight = this.camera.getViewportSize().height;

    // Draw border line
    for (let y = 0; y < viewportHeight; y++) {
      this.displayManager.draw(startX - 1, y, '│', borderColor, backgroundColor);
    }

    // Draw sidebar background
    for (let y = 0; y < viewportHeight; y++) {
      for (let x = 0; x < sidebarWidth; x++) {
        this.displayManager.draw(startX + x, y, ' ', undefined, backgroundColor);
      }
    }

    // Draw header
    this.drawText(0, '─'.repeat(sidebarWidth - 2), borderColor);
    this.drawText(1, ' LOOK MODE ', highlightColor);
    this.drawText(2, '─'.repeat(sidebarWidth - 2), borderColor);

    let currentY = 4;

    // Draw cursor position
    const cursorPos = this.lookMode.getCursorPosition();
    this.drawText(currentY++, `Pos: (${cursorPos.x},${cursorPos.y})`, textColor);

    // Draw visibility status
    const visibility = this.lookMode.getVisibilityStatus();
    const visibilityText = visibility === 'visible' ? 'Visible' : 
                          visibility === 'explored' ? 'Explored (dark)' : 'Unknown';
    const visibilityColor = visibility === 'visible' ? '#00ff00' : 
                           visibility === 'explored' ? dimColor : '#ff0000';
    this.drawText(currentY++, visibilityText, visibilityColor);
    currentY++;

    // Draw tile information
    const tileInfo = this.lookMode.getTileInfo();
    if (tileInfo) {
      this.drawText(currentY++, 'Terrain:', highlightColor);
      
      // Show tile character
      const charDisplay = visibility === 'visible' ? tileInfo.char : 
                         visibility === 'explored' ? tileInfo.char : '?';
      this.drawText(currentY++, `  ${charDisplay} ${tileInfo.name}`, textColor);
      currentY++;
    }

    // Draw entities at cursor
    const entities = this.lookMode.getEntitiesAtCursor();
    if (entities.length > 0) {
      this.drawText(currentY++, 'Entities:', highlightColor);
      for (const entity of entities.slice(0, 3)) { // Show up to 3 entities
        const name = this.getEntityDisplayName(entity);
        this.drawText(currentY++, `  ${name}`, textColor);
      }
      if (entities.length > 3) {
        this.drawText(currentY++, `  ...and ${entities.length - 3} more`, dimColor);
      }
      currentY++;
    }

    // Draw items at cursor
    const items = this.lookMode.getItemsAtCursor();
    if (items.length > 0) {
      this.drawText(currentY++, 'Items:', highlightColor);
      for (const item of items.slice(0, 3)) { // Show up to 3 items
        const name = this.getItemDisplayName(item);
        this.drawText(currentY++, `  ${name}`, textColor);
      }
      if (items.length > 3) {
        this.drawText(currentY++, `  ...and ${items.length - 3} more`, dimColor);
      }
      currentY++;
    }

    // Draw separator
    currentY++;
    this.drawText(currentY++, '─'.repeat(sidebarWidth - 2), borderColor);
    currentY++;

    // Draw available actions
    const actions = this.lookMode.getAvailableActions();
    if (actions.length > 0) {
      this.drawText(currentY++, 'Actions:', highlightColor);
      currentY++;
      
      for (const action of actions) {
        if (currentY >= viewportHeight - 3) break; // Leave room for help text
        
        const description = this.lookMode.getActionDescription(action);
        const actionText = description 
          ? `${action.number})${action.hotkey} ${action.label}: ${description}`
          : `${action.number})${action.hotkey} ${action.label}`;
        
        // Truncate if too long
        const maxLen = sidebarWidth - 2;
        const displayText = actionText.length > maxLen 
          ? actionText.substring(0, maxLen - 3) + '...'
          : actionText;
        
        this.drawText(currentY++, displayText, textColor);
      }
    }

    // Draw help text at bottom
    const helpY = viewportHeight - 2;
    this.drawText(helpY, '─'.repeat(sidebarWidth - 2), borderColor);
    this.drawText(helpY + 1, 'Esc: Exit Look', dimColor);
  }

  /**
   * Draw text at a specific row in the sidebar
   */
  private drawText(y: number, text: string, color: string): void {
    const { startX, sidebarWidth } = this.config;
    const maxLen = sidebarWidth - 2;
    
    // Truncate if too long
    const displayText = text.length > maxLen ? text.substring(0, maxLen) : text;
    
    // Center in sidebar if it's a header
    let x = startX + 1;
    if (text.startsWith('─') || text.startsWith(' LOOK')) {
      x = startX + Math.floor((sidebarWidth - displayText.length) / 2);
    }
    
    this.displayManager.drawText(x, y, displayText, maxLen);
    
    // Redraw with proper colors - drawText doesn't support color per character
    // So we draw character by character for colored text
    for (let i = 0; i < displayText.length && i < maxLen; i++) {
      this.displayManager.draw(x + i, y, displayText[i], color, this.config.backgroundColor);
    }
  }

  /**
   * Get display name for an entity
   */
  private getEntityDisplayName(entity: Entity): string {
    // Check for renderable component for character
    const renderable = entity.getComponent<{ type: 'renderable'; char: string }>('renderable');
    const char = renderable?.char ?? '?';

    // Try to get name from various components
    const health = entity.getComponent<{ type: 'health'; current: number; max: number }>('health');
    const actor = entity.getComponent<{ type: 'actor'; isPlayer: boolean }>('actor');
    
    if (actor?.isPlayer) {
      return `${char} You`;
    }
    
    if (health) {
      return `${char} Creature (${health.current}/${health.max})`;
    }
    
    return `${char} Unknown`;
  }

  /**
   * Get display name for an item
   */
  private getItemDisplayName(item: Entity): string {
    const itemTemplate = item.getComponent<{ type: 'item_template'; name: string }>('item_template');
    const itemComponent = item.getComponent<{ type: 'item'; quantity: number }>('item');
    const renderable = item.getComponent<{ type: 'renderable'; char: string }>('renderable');
    
    const char = renderable?.char ?? '?';
    const name = itemTemplate?.name ?? 'Unknown';
    const qty = itemComponent?.quantity ?? 1;
    
    if (qty > 1) {
      return `${char} ${name} (x${qty})`;
    }
    return `${char} ${name}`;
  }

  /**
   * Update panel configuration
   */
  setConfig(config: Partial<LookPanelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LookPanelConfig {
    return { ...this.config };
  }
}

export default LookPanel;
