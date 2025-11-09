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
    this.transform = null; // Current transform matrix for this group
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
