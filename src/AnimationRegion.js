/**
 * Animation System using DSL format with state guards
 */

import { Mat4 } from './math.js';

export class AnimationRegion {
  constructor(name) {
    this.name = name;
    this.min = [0, 0, 0];
    this.max = [0, 0, 0];
    this.voxels = new Set();
    this.transform = null; // Current transform matrix for this region
    this.state = null; // Current state of the region
    this.initialState = null; // Initial state to reset to
  }

  toJSON() {
    return {
      min: [...this.min],
      max: [...this.max]
    };
  }

  static fromJSON(name, json) {
    const region = new AnimationRegion(name);
    region.min = [...json.min];
    region.max = [...json.max];
    return region;
  }
}
