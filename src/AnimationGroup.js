/**
 * AnimationGroup - A collection of animations and emitters that can be triggered together
 */

export class AnimationGroup {
  constructor(name) {
    this.name = name;
    this.animationNames = []; // List of animation names to trigger
    this.emitterNames = [];   // List of emitter names to start
  }

  addAnimation(animName) {
    if (!this.animationNames.includes(animName)) {
      this.animationNames.push(animName);
    }
  }

  addEmitter(emitterName) {
    if (!this.emitterNames.includes(emitterName)) {
      this.emitterNames.push(emitterName);
    }
  }

  toJSON() {
    return {
      animations: this.animationNames,
      emitters: this.emitterNames
    };
  }

  static fromJSON(name, json) {
    const group = new AnimationGroup(name);
    if (json.animations) {
      group.animationNames = [...json.animations];
    }
    if (json.emitters) {
      group.emitterNames = [...json.emitters];
    }
    return group;
  }
}
