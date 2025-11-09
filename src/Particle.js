/**
 * Individual particle with position, velocity, and lifetime
 */

export class Particle {
  constructor(position, velocity, color, lifetime, size = 0.2) {
    this.position = [...position]; // [x, y, z]
    this.velocity = [...velocity]; // [vx, vy, vz]
    this.color = color; // Material ID (0-15)
    this.lifetime = lifetime; // Total lifetime in seconds
    this.age = 0; // Current age in seconds
    this.size = size; // Size of particle cube
    this.active = true;
  }

  update(dt, gravity = [0, -9.8, 0]) {
    if (!this.active) return;

    this.age += dt;
    
    // Check if particle should die
    if (this.age >= this.lifetime) {
      this.active = false;
      return;
    }

    // Apply velocity
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    // Apply gravity
    this.velocity[0] += gravity[0] * dt;
    this.velocity[1] += gravity[1] * dt;
    this.velocity[2] += gravity[2] * dt;
  }

  isAlive() {
    return this.active && this.age < this.lifetime;
  }

  getAlpha() {
    // Fade out in the last 20% of lifetime
    const fadeStart = this.lifetime * 0.8;
    if (this.age < fadeStart) return 1.0;
    return 1.0 - (this.age - fadeStart) / (this.lifetime - fadeStart);
  }
}
