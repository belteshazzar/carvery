/**
 * Animation DSL Parser and Runner
 */

// Example DSL format:
/*
group door {
  bounds 0,0,0 to 2,4,1
  hinge at 0,0,0 axis y
  rotate 0 to 90 duration 2s
}

group platform {
  bounds 4,0,4 to 8,1,8
  move y 0 to 4 duration 1s
  wait 0.5s
  move y 4 to 0 duration 1s
}
*/

export class AnimationGroup {
  constructor(name) {
    this.name = name;
    this.bounds = {min: [0,0,0], max: [0,0,0]};
    this.pivot = [0,0,0];
    this.axis = [0,1,0];
    this.keyframes = [];
    this.voxels = new Set(); // Will store voxel indices that are part of this group
  }
}

export class AnimationSystem {
  constructor() {
    this.groups = new Map();
    this.playing = false;
    this.time = 0;
  }

  parse(dsl) {
    const lines = dsl.split('\n');
    let currentGroup = null;

    for(const line of lines) {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length === 0 || tokens[0] === '') continue;

      switch(tokens[0]) {
        case 'group':
          currentGroup = new AnimationGroup(tokens[1]);
          this.groups.set(tokens[1], currentGroup);
          break;

        case 'bounds':
          if (!currentGroup) continue;
          const [x1,y1,z1] = tokens[1].split(',').map(Number);
          const [x2,y2,z2] = tokens[3].split(',').map(Number);
          currentGroup.bounds.min = [x1,y1,z1];
          currentGroup.bounds.max = [x2,y2,z2];
          break;

        case 'hinge':
          if (!currentGroup) continue;
          const [px,py,pz] = tokens[2].split(',').map(Number);
          currentGroup.pivot = [px,py,pz];
          currentGroup.axis = tokens[4] === 'y' ? [0,1,0] : 
                             tokens[4] === 'x' ? [1,0,0] : [0,0,1];
          break;

        case 'rotate':
          if (!currentGroup) continue;
          currentGroup.keyframes.push({
            type: 'rotate',
            start: Number(tokens[1]),
            end: Number(tokens[3]),
            duration: parseFloat(tokens[5])
          });
          break;

        case 'move':
          if (!currentGroup) continue;
          const axis = tokens[1];
          currentGroup.keyframes.push({
            type: 'move',
            axis: axis,
            start: Number(tokens[2]),
            end: Number(tokens[4]),
            duration: parseFloat(tokens[6])
          });
          break;

        case 'wait':
          if (!currentGroup) continue;
          currentGroup.keyframes.push({
            type: 'wait',
            duration: parseFloat(tokens[1])
          });
          break;
      }
    }
  }

  assignVoxelsToGroups(isSolid, N) {
    // Clear existing assignments
    for (const group of this.groups.values()) {
      group.voxels.clear();
    }

    // Helper to convert 3D coords to index
    const idx3 = (x,y,z) => x + N * (y + N * z);

    // Assign voxels to groups based on bounds
    for (const group of this.groups.values()) {
      const [minX, minY, minZ] = group.bounds.min;
      const [maxX, maxY, maxZ] = group.bounds.max;

      for(let z = minZ; z <= maxZ; z++) {
        for(let y = minY; y <= maxY; y++) {
          for(let x = minX; x <= maxX; x++) {
            const idx = idx3(x,y,z);
            if (isSolid[idx]) {
              group.voxels.add(idx);
            }
          }
        }
      }
    }
  }

  getVoxelTransforms() {
    // Returns Map<voxelIndex, Mat4>
    const transforms = new Map();
    
    for (const group of this.groups.values()) {
      let groupMatrix = Mat4.identity();
      let totalTime = 0;

      // Calculate current transform based on keyframes and time
      for (const kf of group.keyframes) {
        const localTime = Math.max(0, Math.min(kf.duration, this.time - totalTime));
        const t = localTime / kf.duration;

        switch(kf.type) {
          case 'rotate':
            const angle = kf.start + (kf.end - kf.start) * t;
            groupMatrix = Mat4.multiply(
              groupMatrix,
              Mat4.translate(...group.pivot),
              Mat4.rotate(angle * Math.PI / 180, ...group.axis),
              Mat4.translate(-group.pivot[0], -group.pivot[1], -group.pivot[2])
            );
            break;

          case 'move':
            const dist = kf.start + (kf.end - kf.start) * t;
            const translation = kf.axis === 'x' ? [dist,0,0] :
                              kf.axis === 'y' ? [0,dist,0] : [0,0,dist];
            groupMatrix = Mat4.multiply(groupMatrix, Mat4.translate(...translation));
            break;
        }

        totalTime += kf.duration;
      }

      // Apply transform to all voxels in group
      for (const voxelIdx of group.voxels) {
        transforms.set(voxelIdx, groupMatrix);
      }
    }

    return transforms;
  }
}