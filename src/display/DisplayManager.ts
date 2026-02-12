/**
 * Display Manager
 * Wrapper for rot.js Display
 */

import * as ROT from 'rot-js';
import { Size } from '../core/Types';

export interface DisplayConfig {
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fg?: string;
  bg?: string;
  spacing?: number;
  forceSquareRatio?: boolean;
}

export class DisplayManager {
  private display: ROT.Display;
  private config: DisplayConfig;

  constructor(config: DisplayConfig) {
    this.config = {
      fontSize: 16,
      fontFamily: 'monospace',
      fg: '#cccccc',
      bg: '#000000',
      spacing: 1,
      forceSquareRatio: true,
      ...config
    };

    this.display = new ROT.Display({
      width: this.config.width,
      height: this.config.height,
      fontSize: this.config.fontSize,
      fontFamily: this.config.fontFamily,
      fg: this.config.fg,
      bg: this.config.bg,
      spacing: this.config.spacing,
      forceSquareRatio: this.config.forceSquareRatio
    });
  }

  getDisplay(): ROT.Display {
    return this.display;
  }

  getContainer(): HTMLElement | null {
    return this.display.getContainer();
  }

  draw(x: number, y: number, ch: string | string[], fg?: string, bg?: string): void {
    this.display.draw(x, y, ch, fg ?? null, bg ?? null);
  }

  drawText(x: number, y: number, text: string, maxWidth?: number): number {
    return this.display.drawText(x, y, text, maxWidth);
  }

  clear(): void {
    this.display.clear();
  }

  getSize(): Size {
    const options = this.display.getOptions();
    return {
      width: options.width,
      height: options.height
    };
  }

  computeSize(availWidth: number, availHeight: number): [number, number] {
    return this.display.computeSize(availWidth, availHeight);
  }

  eventToPosition(e: Event): [number, number] | null {
    return (this.display as any).eventToPosition(e);
  }
}
