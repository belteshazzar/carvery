/**
 * Animation System using DSL format
 */

import { Mat4 } from './math.js';

// Example DSL format:
/*
group door [0, 0, 0] to [2, 4, 1]
group platform [4, 0, 4] to [8, 1, 8]

anim door_open {
  group door
  rotate 90 for 2 pivot [0, 0, 0] axis [0, 1, 0]
}

anim door_close {
  group door
  rotate -90 for 2
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

export class Animation {
  constructor(name) {
    this.name = name;
    this.groupName = null;
    this.keyframes = [];
    this.loop = false;
    this.time = 0;
    this.playing = false;
  }

  getTransform() {
    let matrix = Mat4.identity();
    let totalTime = 0;
    const time = this.time;

    for (const kf of this.keyframes) {
      const localTime = Math.max(0, Math.min(kf.duration, time - totalTime));
      const t = kf.duration > 0 ? localTime / kf.duration : 1;

      switch(kf.type) {
        case 'rotate': {
          const angle = kf.delta * t;
          const pivot = kf.pivot || [0, 0, 0];
          const axis = kf.axis || [0, 1, 0];
          const rotMat = Mat4.rotate(angle * Math.PI / 180, ...axis);
          const toOrigin = Mat4.translate(-pivot[0], -pivot[1], -pivot[2]);
          const fromOrigin = Mat4.translate(...pivot);
          matrix = Mat4.multiply(matrix, fromOrigin, rotMat, toOrigin);
          break;
        }

        case 'move': {
          const currentDist = kf.delta * t;
          const translation = kf.axis === 'x' ? [currentDist, 0, 0] :
                            kf.axis === 'y' ? [0, currentDist, 0] : 
                            [0, 0, currentDist];
          matrix = Mat4.multiply(matrix, Mat4.translate(...translation));
          break;
        }

        case 'wait':
          break;
      }

      totalTime += kf.duration;
      
      if (time < totalTime) {
        break;
      }
    }

    return matrix;
  }

  update(dt) {
    if (!this.playing) return;
    this.time += dt;
    
    const duration = this.getTotalDuration();
    if (this.loop && duration > 0 && this.time > duration) {
      this.time = this.time % duration;
    } else if (!this.loop && duration > 0 && this.time >= duration) {
      this.playing = false;
    }
  }

  play() {
    this.playing = true;
  }

  stop() {
    this.playing = false;
  }

  reset() {
    this.time = 0;
  }

  getTotalDuration() {
    return this.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
  }

  toJSON() {
    return {
      groupName: this.groupName,
      loop: this.loop,
      keyframes: this.keyframes.map(kf => ({...kf}))
    };
  }

  static fromJSON(name, json) {
    const anim = new Animation(name);
    anim.groupName = json.groupName;
    anim.loop = json.loop || false;
    anim.keyframes = json.keyframes.map(kf => ({...kf}));
    return anim;
  }
}

export class AnimationSystem {
  constructor() {
    this.groups = new Map(); // groupName -> AnimationGroup
    this.animations = new Map(); // animName -> Animation
  }

  parse(dsl) {
    this.groups.clear();
    this.animations.clear();
    
    const lines = dsl.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    let currentAnim = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a group definition
      // only allowed outside of an animation
      if (currentAnim == null && line.startsWith('group ')) {
        this.parseGroupDefinition(line);
        continue;
      }

      // Check if this is an animation declaration (ends with {)
      if (line.startsWith('anim ') && line.endsWith('{')) {
        const parts = line.slice(5, -1).trim().split(/\s+/);
        const animName = parts[0];
        const loop = parts.includes('loop');
        
        currentAnim = new Animation(animName);
        currentAnim.loop = loop;
        this.animations.set(animName, currentAnim);
        continue;
      }

      // Check if this is the end of an animation
      if (line === '}') {
        currentAnim = null;
        continue;
      }

      if (!currentAnim) continue;

      const tokens = line.split(/\s+/);
      const cmd = tokens[0];

      switch(cmd) {
        case 'group':
          // Set the group for this animation
          currentAnim.groupName = tokens[1];
          break;

        case 'rotate': {
          // rotate 90 for 2 pivot [0, 0, 0] axis [0, 1, 0]
          const rotDelta = parseFloat(tokens[1]);
          const forIdx = tokens.indexOf('for');
          const rotDuration = forIdx > 0 ? parseFloat(tokens[forIdx + 1]) : 1;
          
          const kf = {
            type: 'rotate',
            delta: rotDelta,
            duration: rotDuration
          };

          // Parse optional pivot
          const pivotIdx = tokens.indexOf('pivot');
          if (pivotIdx > 0) {
            const pivotStart = line.indexOf('[', line.indexOf('pivot'));
            const pivotEnd = line.indexOf(']', pivotStart);
            if (pivotStart >= 0 && pivotEnd > pivotStart) {
              const pivotStr = line.substring(pivotStart + 1, pivotEnd);
              kf.pivot = pivotStr.split(',').map(s => parseFloat(s.trim()));
            }
          }

          // Parse optional axis
          const axisIdx = tokens.indexOf('axis');
          if (axisIdx > 0) {
            const axisStart = line.indexOf('[', line.indexOf('axis'));
            const axisEnd = line.indexOf(']', axisStart);
            if (axisStart >= 0 && axisEnd > axisStart) {
              const axisStr = line.substring(axisStart + 1, axisEnd);
              kf.axis = axisStr.split(',').map(s => parseFloat(s.trim()));
            }
          }

          currentAnim.keyframes.push(kf);
          break;
        }

        case 'move':
          // move y 4 for 1
          const moveAxis = tokens[1];
          const moveDelta = parseFloat(tokens[2]);
          const moveDuration = parseFloat(tokens[4]);
          currentAnim.keyframes.push({
            type: 'move',
            axis: moveAxis,
            delta: moveDelta,
            duration: moveDuration
          });
          break;

        case 'wait':
          // wait 0.5
          const waitDuration = parseFloat(tokens[1]);
          currentAnim.keyframes.push({
            type: 'wait',
            duration: waitDuration
          });
          break;
      }
    }
  }

  parseGroupDefinition(line) {
    // group platform [4, 0, 4] to [8, 1, 8]
    const tokens = line.split(/\s+/);
    const groupName = tokens[1];
    
    const group = new AnimationGroup(groupName);
    
    // Find 'to' keyword to split min/max
    const toIndex = tokens.indexOf('to');
    if (toIndex > 0) {
      // Parse min array
      const minStart = line.indexOf('[');
      const minEnd = line.indexOf(']', minStart);
      if (minStart >= 0 && minEnd > minStart) {
        const minStr = line.substring(minStart + 1, minEnd);
        group.min = minStr.split(',').map(s => parseFloat(s.trim()));
      }
      
      // Parse max array
      const maxStart = line.indexOf('[', minEnd);
      const maxEnd = line.indexOf(']', maxStart);
      if (maxStart >= 0 && maxEnd > maxStart) {
        const maxStr = line.substring(maxStart + 1, maxEnd);
        group.max = maxStr.split(',').map(s => parseFloat(s.trim()));
      }
    }
    
    this.groups.set(groupName, group);
  }

  parseArray(line) {
    const match = line.match(/\[(.*?)\]/);
    if (match) {
      return match[1].split(',').map(s => parseFloat(s.trim()));
    }
    return [0, 0, 0];
  }

  fromJSON(data) {
    this.groups.clear();
    this.animations.clear();
    
    if (data.groups && typeof data.groups === 'object') {
      for (const [name, groupData] of Object.entries(data.groups)) {
        const group = AnimationGroup.fromJSON(name, groupData);
        this.groups.set(name, group);
      }
    }
    
    if (data.animations && typeof data.animations === 'object') {
      for (const [name, animData] of Object.entries(data.animations)) {
        const anim = Animation.fromJSON(name, animData);
        this.animations.set(name, anim);
      }
    }
  }

  toJSON() {
    const groups = {};
    for (const [name, group] of this.groups.entries()) {
      groups[name] = group.toJSON();
    }
    
    const animations = {};
    for (const [name, anim] of this.animations.entries()) {
      animations[name] = anim.toJSON();
    }
    
    return { groups, animations };
  }

  assignVoxelsToGroups(chunk) {
    for (const group of this.groups.values()) {
      group.voxels.clear();
    }

    for (const group of this.groups.values()) {
      const [minX, minY, minZ] = group.min;
      const [maxX, maxY, maxZ] = group.max;

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
    for (const anim of this.animations.values()) {
      anim.update(dt);
    }
  }

  playAnimation(animName) {
    const anim = this.animations.get(animName);
    if (anim) {
      anim.reset();
      anim.play();
    } else {
      console.warn('Animation not found:', animName);
    }
  }

  stopAnimation(animName) {
    const anim = this.animations.get(animName);
    if (anim) {
      anim.stop();
    } else {
      console.warn('Animation not found:', animName);
    }
  }

  resetAnimation(animName) {
    const anim = this.animations.get(animName);
    if (anim) {
      anim.reset();
    } else {
      console.warn('Animation not found:', animName);
    }
  }

  resetAll() {
    for (const anim of this.animations.values()) {
      anim.stop();
      anim.reset();
    }
  }

  getGroupTransform(groupName) {
    const group = this.groups.get(groupName);
    if (!group) return Mat4.identity();
    
    // Combine transforms from all playing animations for this group
    let combinedTransform = Mat4.identity();
    for (const anim of this.animations.values()) {
      if (anim.groupName === groupName && anim.playing) {
        const animTransform = anim.getTransform(group);
        combinedTransform = Mat4.multiply(combinedTransform, animTransform);
      }
    }
    
    return combinedTransform;
  }

  getAnimationsForGroup(groupName) {
    return Array.from(this.animations.values())
      .filter(anim => anim.groupName === groupName);
  }
}