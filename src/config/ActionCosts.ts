/**
 * Action cost definitions
 */

export interface ActionCosts {
  [actionType: string]: number;
}

export const ACTION_COSTS: ActionCosts = {
  MOVE: 100,
  ATTACK: 100,
  CRAFT: 300,
  WAIT: 50,
  INTERACT: 100,
  PICKUP: 50,
  DROP: 25,
  USE: 100,
  EQUIP: 50,
  UNEQUIP: 25
};
