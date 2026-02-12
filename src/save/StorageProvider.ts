/**
 * Storage Provider
 * Interface and implementations for save storage
 */

import { SaveMetadata } from './SaveMetadata';

export interface StorageProvider {
  save(slot: number, data: string): Promise<void>;
  load(slot: number): Promise<string | null>;
  delete(slot: number): Promise<boolean>;
  list(): Promise<SaveMetadata[]>;
  exists(slot: number): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private prefix: string = 'ascii_world_save_';
  private metadataPrefix: string = 'ascii_world_meta_';

  async save(slot: number, data: string): Promise<void> {
    try {
      localStorage.setItem(`${this.prefix}${slot}`, data);
    } catch (error) {
      throw new Error(`Failed to save to slot ${slot}: ${error}`);
    }
  }

  async load(slot: number): Promise<string | null> {
    return localStorage.getItem(`${this.prefix}${slot}`);
  }

  async delete(slot: number): Promise<boolean> {
    const key = `${this.prefix}${slot}`;
    const metaKey = `${this.metadataPrefix}${slot}`;
    
    if (localStorage.getItem(key) === null) {
      return false;
    }
    
    localStorage.removeItem(key);
    localStorage.removeItem(metaKey);
    return true;
  }

  async list(): Promise<SaveMetadata[]> {
    const saves: SaveMetadata[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.metadataPrefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            saves.push(JSON.parse(data));
          } catch {
            // Skip invalid metadata
          }
        }
      }
    }
    
    return saves.sort((a, b) => b.timestamp - a.timestamp);
  }

  async exists(slot: number): Promise<boolean> {
    return localStorage.getItem(`${this.prefix}${slot}`) !== null;
  }

  async saveMetadata(slot: number, metadata: SaveMetadata): Promise<void> {
    localStorage.setItem(`${this.metadataPrefix}${slot}`, JSON.stringify(metadata));
  }

  async loadMetadata(slot: number): Promise<SaveMetadata | null> {
    const data = localStorage.getItem(`${this.metadataPrefix}${slot}`);
    return data ? JSON.parse(data) : null;
  }
}
