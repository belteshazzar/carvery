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
    this.guard = null; // Required state to run this animation
    this.endState = null; // State to set when animation completes
  }

  _canPlay() {
    // If no guard is specified, animation can always play
    if (this.guard === null) return true;
    
    // Check if group's current state matches the required guard
    return this.group && this.group.state === this.guard;
  }

  _updateGroupTransform() {
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
          // Interpolate from start angle to end angle
          const angle = kf.from + (kf.to - kf.from) * t;
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
      if (this.endState && this.group) {
        this.group.state = this.endState;
        console.log(`Animation ${this.name} ended, setting group ${this.group.name} state to ${this.endState}`);
      }
      this.playing = false;
    }

    // Update the group's transform
    this._updateGroupTransform();
  }

  play() {
    if (!this._canPlay()) {
      console.log(`Animation ${this.name} cannot play, guard state not met.`);
      return;
    }
    this.playing = true;
  }

  stop() {
    this.playing = false;
  }

  reset() {
    this.time = 0;
    this.playing = false;
  }

  getTotalDuration() {
    return this.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
  }

  toJSON() {
    return {
      groupName: this.groupName,
      loop: this.loop,
      guard: this.guard,
      endState: this.endState,
      keyframes: this.keyframes.map(kf => ({...kf}))
    };
  }

  static fromJSON(name, json) {
    const anim = new Animation(name);
    anim.groupName = json.groupName;
    anim.loop = json.loop || false;
    anim.guard = json.guard;
    anim.endState = json.endState;
    anim.keyframes = json.keyframes.map(kf => ({...kf}));
    return anim;
  }
}
