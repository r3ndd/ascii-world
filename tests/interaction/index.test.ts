/**
 * Interaction Module Integration Tests
 * Tests for the interaction module exports and integration
 */

import {
  LookMode,
  LookModeConfig,
  DEFAULT_LOOK_MODE_CONFIG,
  ContextualAction,
  ActionContext,
  BaseContextualAction,
  ExamineAction,
  GrabAction,
  OpenAction,
  CloseAction,
  UseAction,
  MoveToAction,
  CONTEXTUAL_ACTIONS,
  getAvailableActions
} from '../../src/interaction';

describe('Interaction Module Exports', () => {
  it('should export LookMode', () => {
    expect(LookMode).toBeDefined();
  });

  it('should export LookModeConfig type', () => {
    // TypeScript type - just verify it compiles
    const config: LookModeConfig = { sidebarWidth: 20 };
    expect(config.sidebarWidth).toBe(20);
  });

  it('should export DEFAULT_LOOK_MODE_CONFIG', () => {
    expect(DEFAULT_LOOK_MODE_CONFIG).toBeDefined();
    expect(DEFAULT_LOOK_MODE_CONFIG.sidebarWidth).toBe(20);
  });

  it('should export ContextualAction interface', () => {
    // Interface - verify by creating a mock implementation
    const mockAction: ContextualAction = {
      id: 'test',
      label: 'Test',
      hotkey: 't',
      number: 1,
      cost: 0,
      isAvailable: () => true,
      execute: () => false
    };
    expect(mockAction.id).toBe('test');
  });

  it('should export ActionContext interface', () => {
    // Interface - verify by creating a mock object
    const mockContext: Partial<ActionContext> = {
      targetPosition: { x: 0, y: 0, z: 0 }
    };
    expect(mockContext.targetPosition).toBeDefined();
  });

  it('should export BaseContextualAction class', () => {
    expect(BaseContextualAction).toBeDefined();
  });

  it('should export all action classes', () => {
    expect(ExamineAction).toBeDefined();
    expect(GrabAction).toBeDefined();
    expect(OpenAction).toBeDefined();
    expect(CloseAction).toBeDefined();
    expect(UseAction).toBeDefined();
    expect(MoveToAction).toBeDefined();
  });

  it('should export CONTEXTUAL_ACTIONS registry', () => {
    expect(CONTEXTUAL_ACTIONS).toBeDefined();
    expect(Array.isArray(CONTEXTUAL_ACTIONS)).toBe(true);
    expect(CONTEXTUAL_ACTIONS.length).toBe(6);
  });

  it('should export getAvailableActions function', () => {
    expect(getAvailableActions).toBeDefined();
    expect(typeof getAvailableActions).toBe('function');
  });
});

describe('Action Classes Instantiation', () => {
  it('should instantiate ExamineAction', () => {
    const action = new ExamineAction();
    expect(action.id).toBe('examine');
    expect(action.label).toBe('Examine');
  });

  it('should instantiate GrabAction', () => {
    const action = new GrabAction();
    expect(action.id).toBe('grab');
    expect(action.label).toBe('Grab');
  });

  it('should instantiate OpenAction', () => {
    const action = new OpenAction();
    expect(action.id).toBe('open');
    expect(action.label).toBe('Open');
  });

  it('should instantiate CloseAction', () => {
    const action = new CloseAction();
    expect(action.id).toBe('close');
    expect(action.label).toBe('Close');
  });

  it('should instantiate UseAction', () => {
    const action = new UseAction();
    expect(action.id).toBe('use');
    expect(action.label).toBe('Use');
  });

  it('should instantiate MoveToAction', () => {
    const action = new MoveToAction();
    expect(action.id).toBe('move_to');
    expect(action.label).toBe('Move to');
  });
});

describe('Contextual Actions Registry', () => {
  it('should have unique action IDs', () => {
    const ids = CONTEXTUAL_ACTIONS.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have unique hotkeys', () => {
    const hotkeys = CONTEXTUAL_ACTIONS.map(a => a.hotkey);
    const uniqueHotkeys = new Set(hotkeys);
    expect(uniqueHotkeys.size).toBe(hotkeys.length);
  });

  it('should have unique numbers', () => {
    const numbers = CONTEXTUAL_ACTIONS.map(a => a.number);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(numbers.length);
  });

  it('should have sequential numbers starting from 1', () => {
    const sortedNumbers = [...CONTEXTUAL_ACTIONS]
      .map(a => a.number)
      .sort((a, b) => a - b);
    
    for (let i = 0; i < sortedNumbers.length; i++) {
      expect(sortedNumbers[i]).toBe(i + 1);
    }
  });
});
