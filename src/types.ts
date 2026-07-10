export interface Vec {
  x: number;
  y: number;
}

export interface Ball {
  id: number; // 0 = cue, 1-7 solids, 8 = eight, 9-15 stripes
  pos: Vec;
  vel: Vec;
  inPlay: boolean;
  spinTop: number; // follow (+) / draw (-) carried by the cue ball
  spinSide: number; // side english, -1..1
}

/** Everything that happened during one shot's simulation. */
export interface ShotEvents {
  firstContact: number | null; // id of first ball the cue ball touched
  potted: number[]; // object balls potted, in order
  cuePotted: boolean;
  railContacts: number;
}

export interface Shot {
  angle: number; // radians
  power: number; // 0..1
  spinX: number; // side english -1..1
  spinY: number; // top/back spin -1..1 (+ = topspin)
}

export type Group = 'solid' | 'stripe';
export type Difficulty = 'easy' | 'medium' | 'hard';
