/**
 * Inventory Panel UI Component
 * Renders a sidebar showing player's inventory
 */

import { DisplayManager } from '../index';
import { Camera } from '../index';
import { ECSWorld, Entity } from '../../ecs';
import { EventBus } from '../../core/EventBus';
import { ItemComponent, ItemTemplateComponent } from '../../items/components';
import { Inventory } from '../../items/Inventory';

export interface InventoryPanelConfig {
  sidebarWidth: number;
  startX: number; // Starting column for the sidebar
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  highlightColor: string;
  dimColor: string;
  equippedIndicator: string;
}

export const DEFAULT_INVENTORY_PANEL_CONFIG: InventoryPanelConfig = {
  sidebarWidth: 20,
  startX: 60,
  backgroundColor: '#000000',
  borderColor: '#444444',
  textColor: '#cccccc',
  highlightColor: '#ffff00',
  dimColor: '#666666',
  equippedIndicator: '(E)'
};

interface InventoryItemDisplay {
  entity: Entity;
  name: string;
  char: string;
  quantity: number;
  equipped: boolean;
  weight: number;
}

export class InventoryPanel {
  private displayManager: DisplayManager;
  private camera: Camera;
  private ecsWorld: ECSWorld;
  private config: InventoryPanelConfig;
  private playerInventory: Inventory | null = null;

  constructor(
    displayManager: DisplayManager,
    camera: Camera,
    ecsWorld: ECSWorld,
    eventBus: EventBus,
    config: Partial<InventoryPanelConfig> = {}
  ) {
    this.displayManager = displayManager;
    this.camera = camera;
    this.ecsWorld = ecsWorld;
    this.config = { ...DEFAULT_INVENTORY_PANEL_CONFIG, ...config };

    // Listen for inventory updates
    eventBus.on('inventory:itemAdded', () => this.refresh());
    eventBus.on('inventory:itemRemoved', () => this.refresh());
    eventBus.on('inventory:itemEquipped', () => this.refresh());
    eventBus.on('inventory:itemUnequipped', () => this.refresh());
    eventBus.on('inventory:stacked', () => this.refresh());
    eventBus.on('inventory:itemDropped', () => this.refresh());
  }

  /**
   * Set the player's inventory to display
   */
  setPlayerInventory(inventory: Inventory | null): void {
    this.playerInventory = inventory;
  }

  /**
   * Refresh the panel (called when inventory changes)
   */
  refresh(): void {
    // The panel will re-render on next render() call
  }

  /**
   * Render the inventory panel sidebar
   */
  render(): void {
    const { sidebarWidth, startX, backgroundColor, borderColor, textColor, highlightColor, dimColor, equippedIndicator } = this.config;
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
    this.drawText(1, ' INVENTORY ', highlightColor);
    this.drawText(2, '─'.repeat(sidebarWidth - 2), borderColor);

    let currentY = 4;

    if (!this.playerInventory) {
      this.drawText(currentY, 'No inventory', dimColor);
      return;
    }

    // Get and sort items
    const displayItems = this.getDisplayItems();

    if (displayItems.length === 0) {
      this.drawText(currentY, 'Empty', dimColor);
      currentY += 2;
    } else {
      // Draw items
      for (const item of displayItems) {
        if (currentY >= viewportHeight - 4) {
          this.drawText(currentY, '...more...', dimColor);
          break;
        }

        const equippedMark = item.equipped ? equippedIndicator + ' ' : '';
        const qtyMark = item.quantity > 1 ? ` x${item.quantity}` : '';
        const displayName = `${item.char} ${equippedMark}${item.name}${qtyMark}`;

        // Truncate if too long
        const maxLen = sidebarWidth - 2;
        const truncatedName = displayName.length > maxLen
          ? displayName.substring(0, maxLen - 3) + '...'
          : displayName;

        const color = item.equipped ? highlightColor : textColor;
        this.drawText(currentY, truncatedName, color);
        currentY++;
      }
    }

    // Draw footer separator
    currentY++;
    if (currentY < viewportHeight - 2) {
      this.drawText(currentY, '─'.repeat(sidebarWidth - 2), borderColor);
      currentY += 2;
    }

    // Draw weight info
    if (currentY < viewportHeight - 1) {
      const currentWeight = this.playerInventory.getCurrentWeight(this.ecsWorld);
      const capacity = this.playerInventory.weightCapacity;
      const weightText = `Weight: ${currentWeight.toFixed(1)}/${capacity.toFixed(0)}`;
      this.drawText(currentY, weightText, dimColor);
      currentY++;

      const itemCount = this.playerInventory.getItemCount();
      const countText = `Items: ${itemCount}`;
      this.drawText(currentY, countText, dimColor);
    }
  }

  /**
   * Get display items sorted by equipped first, then alphabetically
   */
  private getDisplayItems(): InventoryItemDisplay[] {
    if (!this.playerInventory) return [];

    const items = this.playerInventory.getItems(this.ecsWorld);
    const displayItems: InventoryItemDisplay[] = [];

    for (const item of items) {
      const itemComp = item.getComponent<ItemComponent>('item');
      const templateComp = item.getComponent<ItemTemplateComponent>('item_template');

      if (!itemComp || !templateComp) continue;

      displayItems.push({
        entity: item,
        name: templateComp.name,
        char: templateComp.character,
        quantity: itemComp.quantity,
        equipped: itemComp.equipped,
        weight: templateComp.weight * itemComp.quantity
      });
    }

    // Sort: equipped first, then alphabetical by name
    displayItems.sort((a, b) => {
      if (a.equipped && !b.equipped) return -1;
      if (!a.equipped && b.equipped) return 1;
      return a.name.localeCompare(b.name);
    });

    return displayItems;
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
    if (text.startsWith('─') || text.startsWith(' INVENTORY')) {
      x = startX + Math.floor((sidebarWidth - displayText.length) / 2);
    }

    this.displayManager.drawText(x, y, displayText, maxLen);

    // Redraw with proper colors - draw character by character
    for (let i = 0; i < displayText.length && i < maxLen; i++) {
      this.displayManager.draw(x + i, y, displayText[i], color, this.config.backgroundColor);
    }
  }

  /**
   * Update panel configuration
   */
  setConfig(config: Partial<InventoryPanelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): InventoryPanelConfig {
    return { ...this.config };
  }
}

export default InventoryPanel;
