/**
 * Animation System using DSL format with state guards
 */

import { Mat4 } from './math.js';

// Example DSL format:
/*
group door {
  min [0, 0, 0]
  max [2, 4, 1]
  state closed
}

group platform {
  min [4, 0, 4]
  max [8, 1, 8]
  state lowered
}

anim door_open {
  group door
  guard closed
  rotate 0 to 90 for 2 pivot [0, 0, 0] axis [0, 1, 0]
  state open
}

anim door_close {
  group door
  guard open
  rotate 90 to 0 for 2 pivot [0, 0, 0] axis [0, 1, 0]
  state closed
}

anim updown loop {
  group platform
  move y 4 for 1
  wait 0.5
  move y -4 for 1
}
*/

export class AnimationGroup {
  constructor(name) {
    this.name = name;
    this.min = [0, 0, 0];
    this.max = [0, 0, 0];
    this.voxels = new Set();
    this.transform = null; // Current transform matrix for this group
    this.state = null; // Current state of the group
    this.initialState = null; // Initial state to reset to
  }

  toJSON() {
    return {
      min: [...this.min],
      max: [...this.max]
    };
  }

  static fromJSON(name, json) {
    const group = new AnimationGroup(name);
    group.min = [...json.min];
    group.max = [...json.max];
    return group;
  }
}
