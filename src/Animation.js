import { Mat4 } from './math.js';

export class Animation {
  constructor(name) {
    this.name = name;
    this.groupName = null;
    this.group = null; // Reference to the AnimationGroup
    this.keyframes = [];
    this.loop = false;
    this.time = 0;
    this.playing = false;
  }

  setGroup(group) {
    this.group = group;
    this.groupName = group.name;
  }

  updateGroupTransform() {
    if (!this.group) return;

    let matrix = Mat4.identity();
    let totalTime = 0;
    let time = this.time;
    
    // If animation is complete and not looping, clamp to final duration
    const duration = this.getTotalDuration();
    if (!this.loop && duration > 0 && time > duration) {
      time = duration;
    }

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

    // Update the group's transform
    this.group.transform = matrix;
  }

  update(dt) {
    if (!this.playing) return;
    
    this.time += dt;
    
    const duration = this.getTotalDuration();
    if (this.loop && duration > 0 && this.time > duration) {
      this.time = this.time % duration;
    } else if (!this.loop && duration > 0 && this.time >= duration) {
      // Clamp to exactly the duration, don't reset
      this.time = duration;
      this.playing = false;
    }

    // Update the group's transform
    this.updateGroupTransform();
  }

  play() {
    this.playing = true;
    // Update transform immediately when starting
    this.updateGroupTransform();
  }

  stop() {
    this.playing = false;
    // Keep transform at current position
  }

  reset() {
    this.time = 0;
    this.playing = false;
    // Reset group transform to identity
    if (this.group) {
      this.group.transform = Mat4.identity();
    }
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
