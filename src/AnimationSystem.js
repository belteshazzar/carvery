/**
 * Animation System using DSL format
 */

import { Animation } from './Animation.js';
import { AnimationRegion } from './AnimationRegion.js';
import { Emitter } from './Emitter.js';
import { AnimationGroup } from './AnimationGroup.js';
import { Mat4 } from './math.js';

export class AnimationSystem {
  constructor() {
    this.regions = new Map(); // regionName -> AnimationRegion
    this.animations = new Map(); // animName -> Animation
    this.emitters = new Map(); // emitterName -> Emitter
    this.groups = new Map(); // groupName -> AnimationGroup
  }

  /**
   * Add a new region programmatically
   */
  addRegion(name, min = [0, 0, 0], max = [1, 1, 1]) {
    if (this.regions.has(name)) {
      throw new Error(`Region "${name}" already exists`);
    }
    const region = new AnimationRegion(name);
    region.min = [...min];
    region.max = [...max];
    region.state = 'default';
    region.initialState = 'default';
    this.regions.set(name, region);
    return region;
  }

  /**
   * Remove a region and any animations that reference it
   */
  removeRegion(name) {
    if (!this.regions.has(name)) {
      return false;
    }
    
    // Remove the region
    this.regions.delete(name);
    
    // Remove any animations that reference this region
    for (const [animName, anim] of this.animations.entries()) {
      if (anim.regionName === name) {
        this.animations.delete(animName);
      }
    }
    
    return true;
  }

  /**
   * Rename a region and update all references
   */
  renameRegion(oldName, newName) {
    if (!this.regions.has(oldName)) {
      throw new Error(`Region "${oldName}" does not exist`);
    }
    
    if (this.regions.has(newName)) {
      throw new Error(`Region "${newName}" already exists`);
    }
    
    if (oldName === newName) {
      return; // No change needed
    }
    
    // Get the region and update its name
    const region = this.regions.get(oldName);
    region.name = newName;
    
    // Update the regions Map
    this.regions.delete(oldName);
    this.regions.set(newName, region);
    
    // Update all animations that reference this region
    for (const anim of this.animations.values()) {
      if (anim.regionName === oldName) {
        anim.regionName = newName;
        anim.region = region;
      }
    }
    
    return true;
  }

  /**
   * Generate a unique region name
   */
  generateUniqueRegionName(baseName = 'region') {
    let counter = 1;
    let name = baseName;
    while (this.regions.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    return name;
  }

  /**
   * Generate a unique animation name
   */
  generateUniqueAnimationName(baseName = 'anim') {
    let counter = 1;
    let name = baseName;
    while (this.animations.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    return name;
  }

  /**
   * Generate a unique emitter name
   */
  generateUniqueEmitterName(baseName = 'emitter') {
    let counter = 1;
    let name = baseName;
    while (this.emitters.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    return name;
  }

  /**
   * Generate a unique group name
   */
  generateUniqueGroupName(baseName = 'group') {
    let counter = 1;
    let name = baseName;
    while (this.groups.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    return name;
  }

  /**
   * Add a new animation programmatically
   */
  addAnimation(name, regionName = null) {
    if (this.animations.has(name)) {
      throw new Error(`Animation "${name}" already exists`);
    }
    const anim = new Animation(name);
    anim.regionName = regionName;
    if (regionName && this.regions.has(regionName)) {
      anim.region = this.regions.get(regionName);
    }
    this.animations.set(name, anim);
    return anim;
  }

  /**
   * Remove an animation
   */
  removeAnimation(name) {
    if (!this.animations.has(name)) {
      return false;
    }
    
    // Remove the animation
    this.animations.delete(name);
    
    // // Remove from any groups that reference it
    // for (const group of this.groups.values()) {
    //   const index = group.animationNames.indexOf(name);
    //   if (index !== -1) {
    //     group.animationNames.splice(index, 1);
    //   }
    // }
    
    return true;
  }

  /**
   * Add a new emitter programmatically
   */
  addEmitter(name) {
    if (this.emitters.has(name)) {
      throw new Error(`Emitter "${name}" already exists`);
    }
    const emitter = new Emitter(name);
    this.emitters.set(name, emitter);
    return emitter;
  }

  /**
   * Remove an emitter
   */
  removeEmitter(name) {
    if (!this.emitters.has(name)) {
      return false;
    }
    
    // Remove the emitter
    this.emitters.delete(name);
    
    // Remove from any groups that reference it
    for (const group of this.groups.values()) {
      const index = group.emitterNames.indexOf(name);
      if (index !== -1) {
        group.emitterNames.splice(index, 1);
      }
    }
    
    return true;
  }

  /**
   * Add a new group programmatically
   */
  addGroup(name) {
    if (this.groups.has(name)) {
      throw new Error(`Group "${name}" already exists`);
    }
    const group = new AnimationGroup(name);
    this.groups.set(name, group);
    return group;
  }

  /**
   * Remove a group
   */
  removeGroup(name) {
    if (!this.groups.has(name)) {
      return false;
    }
    
    // Remove the group
    this.groups.delete(name);
    
    return true;
  }

  linkAnimationsToRegions() {
    for (const anim of this.animations.values()) {
      if (anim.regionName && this.regions.has(anim.regionName)) {
        anim.region = this.regions.get(anim.regionName);
        console.log(`Linked animation ${anim.name} to region ${anim.regionName}`);
      }
    }
  }

  parseArray(line) {
    const match = line.match(/\[(.*?)\]/);
    if (match) {
      return match[1].split(',').map(s => parseFloat(s.trim()));
    }
    return [0, 0, 0];
  }

  fromJSON(data) {
    this.regions.clear();
    this.animations.clear();
    this.emitters.clear();
    this.groups.clear();
    
    if (data.regions && typeof data.regions === 'object') {
      for (const [name, regionData] of Object.entries(data.regions)) {
        const region = AnimationRegion.fromJSON(name, regionData);
        this.regions.set(name, region);
      }
    }
    
    if (data.animations && typeof data.animations === 'object') {
      for (const [name, animData] of Object.entries(data.animations)) {
        const anim = Animation.fromJSON(name, animData);
        this.animations.set(name, anim);
      }
    }

    if (data.emitters && typeof data.emitters === 'object') {
      for (const [name, emitterData] of Object.entries(data.emitters)) {
        const emitter = Emitter.fromJSON(name, emitterData);
        this.emitters.set(name, emitter);
      }
    }

    if (data.groups && typeof data.groups === 'object') {
      for (const [name, groupData] of Object.entries(data.groups)) {
        const group = AnimationGroup.fromJSON(name, groupData);
        this.groups.set(name, group);
      }
    }

    // Link animations to regions
    this.linkAnimationsToRegions();


    console.log('Loaded Animation System from JSON:', this);
  }

  toJSON() {
    const regions = {};
    for (const [name, region] of this.regions.entries()) {
      regions[name] = region.toJSON();
    }
    
    const animations = {};
    for (const [name, anim] of this.animations.entries()) {
      animations[name] = anim.toJSON();
    }
    
    const emitters = {};
    for (const [name, emitter] of this.emitters.entries()) {
      emitters[name] = emitter.toJSON();
    }
    
    const groups = {};
    for (const [name, group] of this.groups.entries()) {
      groups[name] = group.toJSON();
    }
    
    return { regions, animations, emitters, groups };
  }

  assignVoxelsToRegions(chunk) {
    for (const region of this.regions.values()) {
      region.voxels.clear();
    }

    for (const region of this.regions.values()) {
      const [minX, minY, minZ] = region.min;
      const [maxX, maxY, maxZ] = region.max;

      for(let z = minZ; z <= maxZ; z++) {
        for(let y = minY; y <= maxY; y++) {
          for(let x = minX; x <= maxX; x++) {
            const idx = chunk.idx3(x, y, z);
            if (chunk.isSolid(idx)) {
              region.voxels.add(idx);
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
    for (const emitter of this.emitters.values()) {
      emitter.update(dt);
    }
    
    // Check for group completion and set endState
    for (const group of this.groups.values()) {
      if (group.playing && group.endState !== null) {
        // Check if all animations in the group have finished
        let allComplete = true;
        for (const animName of group.animationNames) {
          const anim = this.animations.get(animName);
          if (anim && anim.playing) {
            allComplete = false;
            break;
          }
        }
        
        if (allComplete) {
          // Set the endState on all regions used by animations in this group
          for (const animName of group.animationNames) {
            const anim = this.animations.get(animName);
            if (anim && anim.region) {
              anim.region.state = group.endState;
              console.log(`Group ${group.name} completed, setting region ${anim.region.name} state to ${group.endState}`);
            }
          }
          group.playing = false;
        }
      }
    }
  }

  playAnimation(animName) {
    const anim = this.animations.get(animName);
    if (anim) {
      // Stop any other animations on the same region
      if (anim.regionName) {
        for (const otherAnim of this.animations.values()) {
          if (otherAnim !== anim && otherAnim.regionName === anim.regionName && otherAnim.playing) {
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
    for (const emitter of this.emitters.values()) {
      emitter.reset();
    }
  }

  startEmitter(emitterName) {
    const emitter = this.emitters.get(emitterName);
    if (emitter) {
      emitter.start();
    } else {
      console.warn('Emitter not found:', emitterName);
    }
  }

  stopEmitter(emitterName) {
    const emitter = this.emitters.get(emitterName);
    if (emitter) {
      emitter.stop();
    } else {
      console.warn('Emitter not found:', emitterName);
    }
  }

  clearEmitter(emitterName) {
    const emitter = this.emitters.get(emitterName);
    if (emitter) {
      emitter.clear();
    } else {
      console.warn('Emitter not found:', emitterName);
    }
  }

  playGroup(groupName) {
    const group = this.groups.get(groupName);
    if (!group) {
      console.warn('Group not found:', groupName);
      return;
    }

    // Check guard condition
    if (group.guard !== null) {
      // Need to check if any of the animations' regions match the guard state
      let guardMet = false;
      for (const animName of group.animationNames) {
        const anim = this.animations.get(animName);
        if (anim && anim.region && anim.region.state === group.guard) {
          guardMet = true;
          break;
        }
      }
      
      if (!guardMet) {
        console.log(`Group ${groupName} cannot play, guard state "${group.guard}" not met.`);
        return;
      }
    }

    // Mark group as playing for state tracking
    group.playing = true;
    group.startTime = performance.now();

    // Play all animations in the group
    for (const animName of group.animationNames) {
      this.playAnimation(animName);
    }

    // Start all emitters in the group
    for (const emitterName of group.emitterNames) {
      this.startEmitter(emitterName);
    }
  }

  stopGroup(groupName) {
    const group = this.groups.get(groupName);
    if (!group) {
      console.warn('Group not found:', groupName);
      return;
    }

    group.playing = false;

    // Stop all animations in the group
    for (const animName of group.animationNames) {
      this.stopAnimation(animName);
    }

    // Stop all emitters in the group
    for (const emitterName of group.emitterNames) {
      this.stopEmitter(emitterName);
    }
  }

  resetGroup(groupName) {
    const group = this.groups.get(groupName);
    if (!group) {
      console.warn('Group not found:', groupName);
      return;
    }

    group.playing = false;

    // Reset all animations in the group
    for (const animName of group.animationNames) {
      this.resetAnimation(animName);
    }

    // Clear all emitters in the group
    for (const emitterName of group.emitterNames) {
      this.clearEmitter(emitterName);
    }
  }

  getAllParticles() {
    const allParticles = [];
    for (const emitter of this.emitters.values()) {
      allParticles.push(...emitter.particles);
    }
    return allParticles;
  }

  getRegionTransform(regionName) {
    const region = this.regions.get(regionName);
    if (!region) return Mat4.identity();
    
    // Return the region's transform, or identity if not set
    return region.transform || Mat4.identity();
  }

  getAnimationsForRegion(regionName) {
    return Array.from(this.animations.values())
      .filter(anim => anim.regionName === regionName);
  }
}