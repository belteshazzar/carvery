# Easing Functions in Carvery

This document describes the easing functions available in the Carvery animation system.

## Overview

Easing functions control the rate of change during an animation, making movements feel more natural and dynamic. All easing functions can be applied to both `rotate` and `move` keyframes.

## Syntax

Add the `easing` keyword followed by the easing function name to any `rotate` or `move` command:

```
rotate <from> to <to> for <duration> [pivot [x,y,z]] [axis [x,y,z]] [easing <type>]
move <axis> <delta> for <duration> [easing <type>]
```

## Available Easing Functions

### 1. linear (default)
No easing - constant speed throughout the animation.
```
rotate 0 to 90 for 2 easing linear
```

### 2. ease
Smooth acceleration and deceleration (similar to CSS ease).
```
rotate 0 to 90 for 2 easing ease
```

### 3. ease-in
Slow start, then accelerates.
```
rotate 0 to 90 for 2 easing ease-in
```

### 4. ease-out
Fast start, then decelerates.
```
rotate 0 to 90 for 2 easing ease-out
```

### 5. ease-in-out
Slow start and end, fast in the middle.
```
rotate 0 to 90 for 2 easing ease-in-out
```

### 6. ease-in-back
Anticipation - pulls back before moving forward.
```
rotate 0 to 90 for 2 easing ease-in-back
```

### 7. ease-out-back
Overshoot - goes past the target then settles back.
```
rotate 0 to 90 for 2 easing ease-out-back
```

### 8. ease-in-out-back
Anticipation and overshoot.
```
rotate 0 to 90 for 2 easing ease-in-out-back
```

### 9. ease-in-bounce
Bouncing effect at the start.
```
rotate 0 to 90 for 2 easing ease-in-bounce
```

### 10. ease-out-bounce
Bouncing effect at the end (like a ball dropping).
```
rotate 0 to 90 for 2 easing ease-out-bounce
```

### 11. ease-in-out-bounce
Bouncing effect at both start and end.
```
rotate 0 to 90 for 2 easing ease-in-out-bounce
```

### 12. ease-in-elastic
Elastic/spring effect at the start.
```
rotate 0 to 90 for 2 easing ease-in-elastic
```

### 13. ease-out-elastic
Elastic/spring effect at the end (oscillates around target).
```
rotate 0 to 90 for 2 easing ease-out-elastic
```

### 14. ease-in-out-elastic
Elastic/spring effect at both start and end.
```
rotate 0 to 90 for 2 easing ease-in-out-elastic
```

### 15. steps
Discrete steps instead of smooth interpolation.
You can optionally specify the number of steps (default is 10).
```
rotate 0 to 90 for 2 easing steps
rotate 0 to 90 for 2 easing steps 5
```

### 16. sine
Sinusoidal easing (quarter sine wave).
```
rotate 0 to 90 for 2 easing sine
```

### 17. expo
Exponential easing.
```
rotate 0 to 90 for 2 easing expo
```

### 18. circ
Circular easing.
```
rotate 0 to 90 for 2 easing circ
```

## Complete Examples

### Example 1: Wing Flap with Bounce
```
region left-wing {
  min [0, 2, 0]
  max [0, 3, 6]
}

anim flap-left {
  region left-wing
  loop
  rotate 0 to -60 for 0.3 pivot [1, 4, 0] axis [0, 0, 1] easing ease-out-bounce
  rotate 0 to 60 for 0.3 pivot [1, 4, 0] axis [0, 0, 1] easing ease-out-bounce
}
```

### Example 2: Door Opening with Back Easing
```
region door {
  min [0, 0, 0]
  max [2, 4, 1]
  state closed
}

anim door_open {
  region door
  guard closed
  rotate 0 to 90 for 2 pivot [0, 0, 0] axis [0, 1, 0] easing ease-out-back
  state open
}
```

### Example 3: Elevator with Elastic
```
region elevator {
  min [0, 0, 0]
  max [3, 1, 3]
}

anim elevator_up {
  region elevator
  move y 8 for 2 easing ease-out-elastic
}
```

### Example 4: Stepped Animation (Robot Movement)
```
region robot-arm {
  min [0, 0, 0]
  max [1, 4, 1]
}

anim robot-wave {
  region robot-arm
  loop
  rotate 0 to 90 for 1 pivot [0, 0, 0] axis [1, 0, 0] easing steps 4
  rotate 0 to -90 for 1 pivot [0, 0, 0] axis [1, 0, 0] easing steps 4
}
```

## Notes

- If no easing is specified, `linear` is used by default
- Easing functions are applied to the time parameter before interpolation
- All easing functions maintain the start and end values of the animation
- The `steps` easing is unique in accepting an optional parameter for the number of steps
- Easing functions work the same for both `rotate` and `move` keyframes
