// World units are meters. Standard 9-foot table play area.
export const TABLE_W = 2.24;
export const TABLE_H = 1.12;
export const BALL_R = 0.028575;
export const RAIL_W = 0.09; // visual rail width

// Head string: cue must start left of this on the break ("the kitchen").
export const HEAD_X = TABLE_W * 0.25;
export const FOOT_X = TABLE_W * 0.75; // rack apex

export const MAX_SHOT_SPEED = 8; // m/s at power = 1

// Friction: dv/dt = -(C0 + C1 * v)
export const FRICTION_C0 = 0.35;
export const FRICTION_C1 = 0.45;

export const RESTITUTION_BALL = 0.94;
export const RESTITUTION_CUSHION = 0.72;
export const STOP_SPEED = 0.015;
export const PHYSICS_DT = 1 / 480;

export const BALL_COLORS: Record<number, string> = {
  0: '#f6f2e7',
  1: '#f2b705', 2: '#1d5fbf', 3: '#d1342b', 4: '#5d3a8e',
  5: '#e77e23', 6: '#188154', 7: '#8e2f36', 8: '#1a1a1a',
  9: '#f2b705', 10: '#1d5fbf', 11: '#d1342b', 12: '#5d3a8e',
  13: '#e77e23', 14: '#188154', 15: '#8e2f36',
};
