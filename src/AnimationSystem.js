/**
 * Animation System using DSL format
 */

import { Animation } from './Animation.js';
import { AnimationGroup } from './AnimationGroup.js';
import { Mat4 } from './math.js';

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
          const groupName = tokens[1];
          currentAnim.groupName = groupName;
          // Set group reference if group exists
          if (this.groups.has(groupName)) {
            currentAnim.setGroup(this.groups.get(groupName));
          }
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

    // Link animations to groups after parsing
    this.linkAnimationsToGroups();
  }

  linkAnimationsToGroups() {
    for (const anim of this.animations.values()) {
      if (anim.groupName && this.groups.has(anim.groupName)) {
        anim.setGroup(this.groups.get(anim.groupName));
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

    // Link animations to groups
    this.linkAnimationsToGroups();
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
      // Stop any other animations on the same group
      if (anim.groupName) {
        for (const otherAnim of this.animations.values()) {
          if (otherAnim !== anim && otherAnim.groupName === anim.groupName && otherAnim.playing) {
            otherAnim.stop();
          }
        }
      }
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
    
    // Return the group's transform, or identity if not set
    return group.transform || Mat4.identity();
  }

  getAnimationsForGroup(groupName) {
    return Array.from(this.animations.values())
      .filter(anim => anim.groupName === groupName);
  }
}