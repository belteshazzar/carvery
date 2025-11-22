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
    this.sequences = new Map(); // sequenceName -> AnimationGroup
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
    
    // Update all animations that reference this group
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
   * Generate a unique sequence name
   */
  generateUniqueSequenceName(baseName = 'sequence') {
    let counter = 1;
    let name = baseName;
    while (this.sequences.has(name)) {
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
    
    // // Remove from any sequences that reference it
    // for (const sequence of this.sequences.values()) {
    //   const index = sequence.animationNames.indexOf(name);
    //   if (index !== -1) {
    //     sequence.animationNames.splice(index, 1);
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
    
    // Remove from any sequences that reference it
    for (const sequence of this.sequences.values()) {
      const index = sequence.emitterNames.indexOf(name);
      if (index !== -1) {
        sequence.emitterNames.splice(index, 1);
      }
    }
    
    return true;
  }

  /**
   * Add a new sequence programmatically
   */
  addSequence(name) {
    if (this.sequences.has(name)) {
      throw new Error(`Sequence "${name}" already exists`);
    }
    const sequence = new AnimationSequence(name);
    this.sequences.set(name, sequence);
    return sequence;
  }

  /**
   * Remove a sequence
   */
  removeSequence(name) {
    if (!this.sequences.has(name)) {
      return false;
    }
    
    // Remove the sequence
    this.sequences.delete(name);
    
    return true;
  }

  parse(dsl) {
    this.groups.clear();
    this.animations.clear();
    this.emitters.clear();
    this.sequences.clear();
    
    const lines = dsl.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    let currentGroup = null;
    let currentAnim = null;
    let currentEmitter = null;
    let currentSequence = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a region definition
      // only allowed outside of an animation
      if (currentAnim == null && currentGroup == null && currentEmitter == null && currentSequence == null && line.startsWith('region ') && line.endsWith('{')) {
        const groupName = line.slice(7, -1).trim();
        currentGroup = new AnimationRegion(groupName);
        this.groups.set(groupName, currentGroup);
        continue;
      }

      // Check if this is an animation declaration (ends with {)
      if (currentAnim == null && currentGroup == null && currentEmitter == null && currentSequence == null && line.startsWith('anim ') && line.endsWith('{')) {
        const animName = line.slice(5, -1).trim();
        currentAnim = new Animation(animName);
        this.animations.set(animName, currentAnim);
        continue;
      }

      // Check if this is an emitter declaration (ends with {)
      if (currentAnim == null && currentGroup == null && currentEmitter == null && currentSequence == null && line.startsWith('emitter ') && line.endsWith('{')) {
        const emitterName = line.slice(8, -1).trim();
        currentEmitter = new Emitter(emitterName);
        this.emitters.set(emitterName, currentEmitter);
        continue;
      }

      // Check if this is a sequence declaration (ends with {)
      if (currentAnim == null && currentGroup == null && currentEmitter == null && currentSequence == null && line.startsWith('anims ') && line.endsWith('{')) {
        const sequenceName = line.slice(6, -1).trim();
        currentSequence = new AnimationSequence(sequenceName);
        this.sequences.set(sequenceName, currentSequence);
        continue;
      }

      // Check if this is the end of a block
      if (line === '}') {
        if (currentGroup) currentGroup = null;
        if (currentAnim) currentAnim = null;
        if (currentEmitter) currentEmitter = null;
        if (currentSequence) currentSequence = null;
        continue;
      }

      const tokens = line.split(/\s+/);
      const cmd = tokens[0];

      // Handle group-level commands
      if (currentGroup && !currentAnim) {
        switch(cmd) {
          case 'min':
            currentGroup.min = this.parseArray(line);
            break;

          case 'max':
            currentGroup.max = this.parseArray(line);
            break;

          case 'state':
            const state = tokens[1];
            currentGroup.state = state;
            currentGroup.initialState = state;
            break;
        }
        continue;
      }

      // Handle animation-level commands
      if (! currentGroup && currentAnim && !currentEmitter) {
        switch(cmd) {
          case 'loop':
            currentAnim.loop = true;
            break;

          case 'guard':
            // Set the guard state for this animation
            currentAnim.guard = tokens[1];
            console.log(`Set guard for animation ${currentAnim.name} to ${currentAnim.guard}`);
            break;

          case 'state':
            // Set the end state for this animation
            currentAnim.endState = tokens[1];
            console.log(`Set end state for animation ${currentAnim.name} to ${currentAnim.endState}`);
            break;

          case 'region':
          case 'group':
            // Set the region for this animation (support both 'region' and legacy 'group')
            currentAnim.groupName = tokens[1];
            console.log(`Set region for animation ${currentAnim.name} to ${currentAnim.groupName}`);
            break;

          case 'rotate': {
            // rotate 0 to 90 for 2 pivot [0, 0, 0] axis [0, 1, 0] easing ease-in-out
            const toIdx = tokens.indexOf('to');
            const forIdx = tokens.indexOf('for');
            
            if (toIdx < 0 || forIdx < 0) {
              console.warn('Invalid rotate syntax, expected: rotate <from> to <to> for <duration>');
              break;
            }
            
            const fromAngle = parseFloat(tokens[1]);
            const toAngle = parseFloat(tokens[toIdx + 1]);
            const duration = parseFloat(tokens[forIdx + 1]);
            
            const kf = {
              type: 'rotate',
              from: fromAngle,
              to: toAngle,
              duration: duration
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

            // Parse optional easing
            const easingIdx = tokens.indexOf('easing');
            if (easingIdx > 0 && easingIdx + 1 < tokens.length) {
              kf.easing = tokens[easingIdx + 1];
              
              // Parse optional steps parameter for 'steps' easing
              if (kf.easing === 'steps' && easingIdx + 2 < tokens.length) {
                const stepsVal = parseInt(tokens[easingIdx + 2], 10);
                if (!isNaN(stepsVal)) {
                  kf.steps = stepsVal;
                }
              }
            }

            currentAnim.keyframes.push(kf);
            break;
          }

          case 'move':
            // move y 4 for 1 easing ease-out
            const moveAxis = tokens[1];
            const moveDelta = parseFloat(tokens[2]);
            const moveDuration = parseFloat(tokens[4]);
            const moveKf = {
              type: 'move',
              axis: moveAxis,
              delta: moveDelta,
              duration: moveDuration
            };
            
            // Parse optional easing
            const moveEasingIdx = tokens.indexOf('easing');
            if (moveEasingIdx > 0 && moveEasingIdx + 1 < tokens.length) {
              moveKf.easing = tokens[moveEasingIdx + 1];
              
              // Parse optional steps parameter for 'steps' easing
              if (moveKf.easing === 'steps' && moveEasingIdx + 2 < tokens.length) {
                const stepsVal = parseInt(tokens[moveEasingIdx + 2], 10);
                if (!isNaN(stepsVal)) {
                  moveKf.steps = stepsVal;
                }
              }
            }
            
            currentAnim.keyframes.push(moveKf);
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

      // Handle emitter-level commands
      if (!currentGroup && !currentAnim && currentEmitter) {
        switch(cmd) {
          case 'position':
          case 'pos':
            currentEmitter.position = this.parseArray(line);
            break;

          case 'rate':
            currentEmitter.rate = parseFloat(tokens[1]);
            break;

          case 'lifetime':
            currentEmitter.particleLifetime = parseFloat(tokens[1]);
            break;

          case 'size':
            currentEmitter.particleSize = parseFloat(tokens[1]);
            break;

          case 'velocity':
          case 'vel':
            currentEmitter.velocityBase = this.parseArray(line);
            break;

          case 'spread':
            currentEmitter.velocitySpread = this.parseArray(line);
            break;

          case 'colors':
          case 'color':
            // Parse array of color indices: colors [1, 2, 3]
            currentEmitter.colorIds = this.parseArray(line).map(v => Math.floor(v));
            break;

          case 'gravity':
            currentEmitter.gravity = this.parseArray(line);
            break;

          case 'max':
            currentEmitter.maxParticles = parseInt(tokens[1]);
            break;
        }
      }

      // Handle sequence-level commands
      if (!currentGroup && !currentAnim && !currentEmitter && currentSequence) {
        switch(cmd) {
          case 'anim':
            // Add animation to sequence: anim walk-left
            const animName = tokens[1];
            currentSequence.addAnimation(animName);
            break;

          case 'emitter':
            // Add emitter to sequence: emitter fountain
            const emitterName = tokens[1];
            currentSequence.addEmitter(emitterName);
            break;
        }
      }
    }

    // Link animations to regions after parsing
    this.linkAnimationsToRegions();

    console.log('Parsed Animation System:', this);
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
    this.sequences.clear();
    
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

    if (data.sequences && typeof data.sequences === 'object') {
      for (const [name, sequenceData] of Object.entries(data.sequences)) {
        const sequence = AnimationSequence.fromJSON(name, sequenceData);
        this.sequences.set(name, sequence);
      }
    }

    // Link animations to groups
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
    
    const sequences = {};
    for (const [name, sequence] of this.sequences.entries()) {
      sequences[name] = sequence.toJSON();
    }
    
    return { regions, animations, emitters, sequences };
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

  playSequence(sequenceName) {
    const sequence = this.sequences.get(sequenceName);
    if (!sequence) {
      console.warn('Sequence not found:', sequenceName);
      return;
    }

    // Play all animations in the sequence
    for (const animName of sequence.animationNames) {
      this.playAnimation(animName);
    }

    // Start all emitters in the sequence
    for (const emitterName of sequence.emitterNames) {
      this.startEmitter(emitterName);
    }
  }

  stopSequence(sequenceName) {
    const sequence = this.sequences.get(sequenceName);
    if (!sequence) {
      console.warn('Sequence not found:', sequenceName);
      return;
    }

    // Stop all animations in the sequence
    for (const animName of sequence.animationNames) {
      this.stopAnimation(animName);
    }

    // Stop all emitters in the sequence
    for (const emitterName of sequence.emitterNames) {
      this.stopEmitter(emitterName);
    }
  }

  resetSequence(sequenceName) {
    const sequence = this.sequences.get(sequenceName);
    if (!sequence) {
      console.warn('Sequence not found:', sequenceName);
      return;
    }

    // Reset all animations in the sequence
    for (const animName of sequence.animationNames) {
      this.resetAnimation(animName);
    }

    // Clear all emitters in the sequence
    for (const emitterName of sequence.emitterNames) {
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