/**
 * Animation System using JSON format
 */

import { Mat4 } from './math.js';

// Example JSON format:
/*
{
  "groups": [
    {
      "name": "door",
      "bounds": { "min": [0, 0, 0], "max": [2, 4, 1] },
      "pivot": [0, 0, 0],
      "axis": [0, 1, 0],
      "loop": true,
      "keyframes": [
        { "type": "rotate", "start": 0, "end": 90, "duration": 2 }
      ]
    },
    {
      "name": "platform",
      "bounds": { "min": [4, 0, 4], "max": [8, 1, 8] },
      "loop": false,
      "keyframes": [
        { "type": "move", "axis": "y", "start": 0, "end": 4, "duration": 1 },
        { "type": "wait", "duration": 0.5 },
        { "type": "move", "axis": "y", "start": 4, "end": 0, "duration": 1 }
      ]
    }
  ]
}
*/

export class AnimationGroup {
  constructor(name) {
    this.name = name;
    this.bounds = {min: [0,0,0], max: [0,0,0]};
    this.pivot = [0,0,0];
    this.axis = [0,1,0];
    this.keyframes = [];
    this.voxels = new Set();
    this.loop = false;
    this.time = 0;
  }

  getTransform() {
    let groupMatrix = Mat4.identity();
    let totalTime = 0;
    const time = this.time;

    // Calculate current transform based on keyframes and time
    for (const kf of this.keyframes) {
      const localTime = Math.max(0, Math.min(kf.duration, time - totalTime));
      const t = kf.duration > 0 ? localTime / kf.duration : 1;

      switch(kf.type) {
        case 'rotate': {
          const angle = kf.start + (kf.end - kf.start) * t;
          const rotMat = Mat4.rotate(angle * Math.PI / 180, ...this.axis);
          const toOrigin = Mat4.translate(-this.pivot[0], -this.pivot[1], -this.pivot[2]);
          const fromOrigin = Mat4.translate(...this.pivot);
          groupMatrix = Mat4.multiply(groupMatrix, fromOrigin, rotMat, toOrigin);
          break;
        }

        case 'move': {
          // Calculate the delta for THIS keyframe
          const currentPos = kf.start + (kf.end - kf.start) * t;
          const delta = kf.axis === 'x' ? [currentPos - kf.start, 0, 0] :
                        kf.axis === 'y' ? [0, currentPos - kf.start, 0] : 
                        [0, 0, currentPos - kf.start];
          
          // If this keyframe is complete, use the full delta
          if (time >= totalTime + kf.duration) {
            const fullDelta = kf.axis === 'x' ? [kf.end - kf.start, 0, 0] :
                             kf.axis === 'y' ? [0, kf.end - kf.start, 0] : 
                             [0, 0, kf.end - kf.start];
            groupMatrix = Mat4.multiply(groupMatrix, Mat4.translate(...fullDelta));
          } else {
            // Otherwise use the interpolated delta
            groupMatrix = Mat4.multiply(groupMatrix, Mat4.translate(...delta));
          }
          break;
        }

        case 'wait':
          // No transform, just advance time
          break;
      }

      totalTime += kf.duration;
      
      // Don't break early - we need to accumulate all completed transforms
      if (time < totalTime) {
        // Current keyframe is still playing, no need to continue
        break;
      }
    }

    return groupMatrix;
  }

  update(dt) {
    this.time += dt;
    
    // Handle per-group looping
    const duration = this.getTotalDuration();
    if (this.loop && duration > 0 && this.time > duration) {
      this.time = this.time % duration;
    }
  }

  reset() {
    this.time = 0;
  }

  getTotalDuration() {
    return this.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
  }

  toJSON() {
    return {
      name: this.name,
      bounds: {
        min: [...this.bounds.min],
        max: [...this.bounds.max]
      },
      pivot: [...this.pivot],
      axis: [...this.axis],
      loop: this.loop,
      keyframes: this.keyframes.map(kf => ({...kf}))
    };
  }

  static fromJSON(json) {
    const group = new AnimationGroup(json.name);
    group.bounds = {
      min: [...json.bounds.min],
      max: [...json.bounds.max]
    };
    group.pivot = json.pivot ? [...json.pivot] : [0, 0, 0];
    group.axis = json.axis ? [...json.axis] : [0, 1, 0];
    group.loop = json.loop || false;
    group.keyframes = json.keyframes.map(kf => ({...kf}));
    return group;
  }
}

export class AnimationSystem {
  constructor() {
    this.groups = new Map();
    this.playing = false;
  }

  parse(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      this.fromJSON(data);
    } catch (e) {
      console.error('Failed to parse animation JSON:', e);
      throw e;
    }
  }

  fromJSON(data) {
    this.groups.clear();
    
    if (data.groups && Array.isArray(data.groups)) {
      for (const groupData of data.groups) {
        const group = AnimationGroup.fromJSON(groupData);
        this.groups.set(group.name, group);
      }
    }
  }

  toJSON() {
    return {
      groups: Array.from(this.groups.values()).map(g => g.toJSON())
    };
  }

  assignVoxelsToGroups(chunk) {
    // Clear existing assignments
    for (const group of this.groups.values()) {
      group.voxels.clear();
    }

    // Assign voxels to groups based on bounds
    for (const group of this.groups.values()) {
      const [minX, minY, minZ] = group.bounds.min;
      const [maxX, maxY, maxZ] = group.bounds.max;

      for(let z = minZ; z <= maxZ; z++) {
        for(let y = minY; y <= maxY; y++) {
          for(let x = minX; x <= maxX; x++) {
            const idx = chunk.idx3(x, y, z);
            if (chunk.isSolid(idx)) {
              group.voxels.add(idx);
            }
          }
        }
      }
    }
  }

  update(dt) {
    if (!this.playing) return;
    
    // Update each group independently
    for (const group of this.groups.values()) {
      group.update(dt);
    }
  }

  triggerGroup(groupName) {
    const group = this.groups.get(groupName);
    if (group && !group.loop) {
      group.reset();
      this.playing = true;
    }
  }

  trigger() {
    // Reset and play all non-looping animations
    for (const group of this.groups.values()) {
      if (!group.loop) {
        group.reset();
      }
    }
    this.playing = true;
  }

  reset() {
    this.playing = false;
    for (const group of this.groups.values()) {
      group.reset();
    }
  }

  getGroupTransform(groupName) {
    const group = this.groups.get(groupName);
    if (!group) return Mat4.identity();
    return group.getTransform();
  }
}