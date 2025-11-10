/**
 * Particle emitter that spawns particles with configurable properties
 */

import { Particle } from './Particle.js';

export class Emitter {
  constructor(name) {
    this.name = name;
    this.position = [0, 0, 0]; // World position
    this.enabled = false;
    
    // Emission properties
    this.rate = 10; // Particles per second
    this.particleLifetime = 2.0; // How long each particle lives
    this.particleSize = 0.2; // Size of each particle cube
    
    // Velocity properties
    this.velocityBase = [0, 5, 0]; // Base velocity
    this.velocitySpread = [1, 1, 1]; // Random spread amount
    
    // Color properties
    this.colorIds = [0]; // Material IDs to use (random pick from array)
    
    // Gravity
    this.gravity = [0, -9.8, 0]; // Gravity acceleration
    
    // Internal state
    this.particles = [];
    this.timeSinceEmit = 0;
    this.maxParticles = 1000; // Safety limit
  }

  update(dt) {
    if (!this.enabled) return;

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt, this.gravity);
      
      // Remove dead particles
      if (!p.isAlive()) {
        this.particles.splice(i, 1);
      }
    }

    // Emit new particles
    this.timeSinceEmit += dt;
    const emitInterval = 1.0 / this.rate;
    
    while (this.timeSinceEmit >= emitInterval && this.particles.length < this.maxParticles) {
      this.emitParticle();
      this.timeSinceEmit -= emitInterval;
    }
  }

  emitParticle() {
    // Random velocity based on base + spread
    const vx = this.velocityBase[0] + (Math.random() - 0.5) * this.velocitySpread[0] * 2;
    const vy = this.velocityBase[1] + (Math.random() - 0.5) * this.velocitySpread[1] * 2;
    const vz = this.velocityBase[2] + (Math.random() - 0.5) * this.velocitySpread[2] * 2;
    
    // Random color from available colors
    const colorId = this.colorIds[Math.floor(Math.random() * this.colorIds.length)];
    
    const particle = new Particle(
      [...this.position],
      [vx, vy, vz],
      colorId,
      this.particleLifetime,
      this.particleSize
    );
    
    this.particles.push(particle);
  }

  start() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }

  clear() {
    this.particles = [];
    this.timeSinceEmit = 0;
  }

  reset() {
    this.stop();
    this.clear();
  }

  toJSON() {
    return {
      position: [...this.position],
      rate: this.rate,
      particleLifetime: this.particleLifetime,
      particleSize: this.particleSize,
      velocityBase: [...this.velocityBase],
      velocitySpread: [...this.velocitySpread],
      colorIds: [...this.colorIds],
      gravity: [...this.gravity],
      maxParticles: this.maxParticles
    };
  }

  static fromJSON(name, json) {
    const emitter = new Emitter(name);
    emitter.position = [...json.position];
    emitter.rate = json.rate || 10;
    emitter.particleLifetime = json.particleLifetime || 2.0;
    emitter.particleSize = json.particleSize || 0.2;
    emitter.velocityBase = json.velocityBase ? [...json.velocityBase] : [0, 5, 0];
    emitter.velocitySpread = json.velocitySpread ? [...json.velocitySpread] : [1, 1, 1];
    emitter.colorIds = json.colorIds ? [...json.colorIds] : [0];
    emitter.gravity = json.gravity ? [...json.gravity] : [0, -9.8, 0];
    emitter.maxParticles = json.maxParticles || 1000;
    return emitter;
  }
}
