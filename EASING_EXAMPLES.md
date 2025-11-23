# Easing Functions Examples

This file contains practical examples of all 18 easing functions in the Carvery animation system.

## Basic Syntax

```
rotate <from> to <to> for <duration> [options...] easing <type>
move <axis> <delta> for <duration> easing <type>
```

## Complete Examples

### 1. Linear (Default)
Constant speed throughout - no acceleration or deceleration.

```dsl
region box {
  min [0, 0, 0]
  max [2, 2, 2]
}

anim linear-rotate {
  region box
  rotate 0 to 360 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing linear
}
```

### 2. Ease
Smooth start and end, similar to CSS ease.

```dsl
anim ease-rotate {
  region box
  rotate 0 to 180 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing ease
}
```

### 3. Ease-In
Slow start, then accelerates.

```dsl
anim ease-in-move {
  region box
  move y 8 for 2 easing ease-in
}
```

### 4. Ease-Out
Fast start, then decelerates.

```dsl
anim ease-out-move {
  region box
  move y 8 for 2 easing ease-out
}
```

### 5. Ease-In-Out
Slow start and end, fast in the middle.

```dsl
anim ease-in-out-rotate {
  region box
  rotate 0 to 90 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing ease-in-out
}
```

### 6. Ease-In-Back
Anticipation - pulls back before moving forward.

```dsl
anim ease-in-back-jump {
  region box
  move y 4 for 1 easing ease-in-back
}
```

### 7. Ease-Out-Back
Overshoot - goes past the target then settles back.

```dsl
anim ease-out-back-rotate {
  region box
  rotate 0 to 90 for 1.5 pivot [1, 1, 1] axis [0, 1, 0] easing ease-out-back
}
```

### 8. Ease-In-Out-Back
Anticipation at start, overshoot at end.

```dsl
anim ease-in-out-back-move {
  region box
  move x 6 for 2 easing ease-in-out-back
}
```

### 9. Ease-In-Bounce
Bouncing effect at the start.

```dsl
anim ease-in-bounce-drop {
  region box
  move y -8 for 2 easing ease-in-bounce
}
```

### 10. Ease-Out-Bounce
Bouncing effect at the end (like a ball dropping).

```dsl
anim ease-out-bounce-land {
  region box
  move y -8 for 2 easing ease-out-bounce
}
```

### 11. Ease-In-Out-Bounce
Bouncing effect at both start and end.

```dsl
anim ease-in-out-bounce-hop {
  region box
  move y 4 for 2 easing ease-in-out-bounce
}
```

### 12. Ease-In-Elastic
Elastic/spring effect at the start.

```dsl
anim ease-in-elastic-spin {
  region box
  rotate 0 to 360 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing ease-in-elastic
}
```

### 13. Ease-Out-Elastic
Elastic/spring effect at the end (oscillates around target).

```dsl
anim ease-out-elastic-stretch {
  region box
  move z 6 for 2 easing ease-out-elastic
}
```

### 14. Ease-In-Out-Elastic
Elastic/spring effect at both start and end.

```dsl
anim ease-in-out-elastic-wave {
  region box
  rotate 0 to 180 for 2 pivot [1, 1, 1] axis [1, 0, 0] easing ease-in-out-elastic
}
```

### 15. Steps
Discrete steps instead of smooth interpolation. Optional step count (default 10).

```dsl
// Default steps (10)
anim steps-default {
  region box
  rotate 0 to 90 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing steps
}

// Custom step count (4 steps)
anim steps-4 {
  region box
  rotate 0 to 360 for 4 pivot [1, 1, 1] axis [0, 1, 0] easing steps 4
}
```

### 16. Sine
Sinusoidal easing (quarter sine wave).

```dsl
anim sine-sway {
  region box
  rotate 0 to 45 for 2 pivot [1, 1, 1] axis [0, 0, 1] easing sine
}
```

### 17. Expo
Exponential easing.

```dsl
anim expo-accelerate {
  region box
  move x 10 for 2 easing expo
}
```

### 18. Circ
Circular easing.

```dsl
anim circ-curve {
  region box
  rotate 0 to 90 for 2 pivot [1, 1, 1] axis [0, 1, 0] easing circ
}
```

## Complex Example: Door with Multiple Easings

```dsl
region door {
  min [0, 0, 0]
  max [2, 5, 0]
  state closed
}

anim door_open {
  region door
  guard closed
  rotate 0 to 90 for 1.5 pivot [0, 0, 0] axis [0, 1, 0] easing ease-out-back
  state open
}

anim door_close {
  region door
  guard open
  rotate 0 to -90 for 1.5 pivot [0, 0, 0] axis [0, 1, 0] easing ease-in-back
  state closed
}
```

## Flying Bird with Natural Movement

```dsl
region bird {
  min [0, 0, 0]
  max [4, 2, 4]
}

anim bird_fly {
  region bird
  loop
  // Wings flap with ease-in-out for smooth motion
  rotate 0 to -30 for 0.15 pivot [2, 1, 2] axis [0, 0, 1] easing ease-in-out
  rotate 0 to 60 for 0.3 pivot [2, 1, 2] axis [0, 0, 1] easing ease-in-out
  rotate 0 to -30 for 0.15 pivot [2, 1, 2] axis [0, 0, 1] easing ease-in-out
  // Rise with elastic for natural lift
  move y 2 for 0.6 easing ease-out-elastic
  // Glide forward
  move x 4 for 0.6 easing linear
}
```

## Robot Arm with Precise Control

```dsl
region robot_arm {
  min [0, 0, 0]
  max [1, 6, 1]
}

anim robot_wave {
  region robot_arm
  loop
  // Mechanical movement with steps
  rotate 0 to 90 for 1 pivot [0, 0, 0] axis [1, 0, 0] easing steps 5
  wait 0.5
  rotate 0 to -90 for 1 pivot [0, 0, 0] axis [1, 0, 0] easing steps 5
  wait 0.5
}
```

## Notes

- All easing functions work with both `rotate` and `move` keyframes
- Easing is optional - if not specified, `linear` is used
- The `steps` easing accepts an optional parameter for the number of steps
- Easing functions maintain the start and end values - they only affect the interpolation curve
- Multiple keyframes in the same animation can use different easing functions
