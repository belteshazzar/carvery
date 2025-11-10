# Particle Emitter System

The Carvery voxel editor now supports particle emitters as part of the animation DSL. Emitters spawn small voxel-like cubes that can be used to create effects like water fountains, fireworks, smoke, fire, and more.

## DSL Syntax

Define an emitter in the animation DSL textarea using the following syntax:

```
emitter <name> {
  pos [x, y, z]              # Position in 3D space
  rate <number>              # Particles per second
  lifetime <number>          # How long each particle lives (seconds)
  size <number>              # Size of each particle cube (default: 0.2)
  velocity [vx, vy, vz]      # Base velocity vector
  spread [sx, sy, sz]        # Random velocity spread
  colors [id1, id2, ...]     # Palette color IDs (0-15) to randomly choose from
  gravity [gx, gy, gz]       # Gravity acceleration vector (default: [0, -9.8, 0])
  max <number>               # Maximum number of particles (default: 1000)
}
```

## Example Emitters

### Water Fountain
```
emitter fountain {
  pos [8, 0, 8]
  rate 50
  lifetime 2.5
  size 0.15
  velocity [0, 8, 0]
  spread [1.5, 0.5, 1.5]
  colors [9, 10]
  gravity [0, -9.8, 0]
}
```

### Firework
```
emitter firework {
  pos [8, 12, 8]
  rate 100
  lifetime 1.5
  size 0.1
  velocity [0, 2, 0]
  spread [4, 4, 4]
  colors [1, 3, 6, 14]
  gravity [0, -3, 0]
}
```

### Smoke
```
emitter smoke {
  pos [2, 2, 2]
  rate 20
  lifetime 3.0
  size 0.25
  velocity [0, 1.5, 0]
  spread [0.3, 0.2, 0.3]
  colors [7, 8]
  gravity [0, 0.5, 0]
}
```

### Fire
```
emitter fire {
  pos [4, 0, 4]
  rate 80
  lifetime 1.0
  size 0.12
  velocity [0, 3, 0]
  spread [0.5, 0.3, 0.5]
  colors [1, 8, 9]
  gravity [0, 0.2, 0]
}
```

## Controls

After compiling your DSL:

1. **Start Emitter**: Click the ▶ (play) button next to the emitter name
2. **Stop Emitter**: Click the ⏹ (stop) button to pause particle emission
3. **Clear Particles**: Click the ✕ button to remove all existing particles
4. **Play All**: Click "Play Loops" to start all emitters and looping animations
5. **Pause All**: Click "Pause All" to stop all emitters and animations

## Properties Explained

### Position (`pos`)
The 3D coordinate where particles spawn. Uses the same coordinate system as voxels (0-16 for each axis).

### Rate
Number of particles emitted per second. Higher values create denser effects.

### Lifetime
How long each particle exists before disappearing (in seconds). Particles fade out in the last 20% of their lifetime.

### Size
The scale of each particle cube. Default is 0.2, making particles smaller than voxels (which are size 1.0).

### Velocity
The base velocity vector for particles. Particles will move in this direction initially.

### Spread
Random variation added to the base velocity. Each component is ±spread/2. Higher spread creates more chaotic movement.

### Colors
Array of palette color indices (0-15). Each particle randomly picks one color from this array. Use the palette editor to customize colors.

### Gravity
Acceleration applied to particles over time. Default is [0, -9.8, 0] (downward, earth-like gravity). Use [0, 0.5, 0] for upward drift (smoke), or [0, 0, 0] for no gravity.

### Max
Safety limit on total number of particles. Prevents performance issues. Default is 1000.

## Physics

Particles use simple physics:
- Position updates based on velocity each frame
- Velocity updates based on gravity each frame
- Particles are removed when their lifetime expires
- Particles fade out (become transparent) near the end of their lifetime

## Rendering

Particles are rendered as small cubes using instanced rendering for performance. They support:
- Transparency (fade out effect)
- Palette-based coloring (matches voxel colors)
- Lambert lighting (same as voxels)
- Blend mode for smooth alpha transparency

## Performance Tips

- Keep `max` at reasonable levels (1000 or less for most effects)
- Lower `rate` if you see frame drops
- Shorter `lifetime` means fewer total particles
- Multiple small emitters are better than one huge emitter

## Integration with Animations

Emitters work alongside voxel animations (groups, rotations, movements). They can be:
- Started/stopped independently
- Combined with animated voxel groups for complex effects
- Saved and loaded with your voxel scenes (via Export/Import)

## DSL Comments

Use `//` for single-line comments in the DSL:

```
// This is a comment
emitter test {
  pos [8, 0, 8]  // Position at center bottom
  rate 50
  // More properties...
}
```
