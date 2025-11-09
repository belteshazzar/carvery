/**
 * Easing functions for animations
 * All functions take a value t in [0, 1] and return an eased value in [0, 1]
 */

export const easingFunctions = {
  // Linear - no easing
  linear: (t) => t,

  // Ease - smooth acceleration and deceleration (CSS ease equivalent)
  ease: (t) => {
    // cubic-bezier(0.25, 0.1, 0.25, 1.0)
    const t2 = t * t;
    const t3 = t2 * t;
    return 3 * t2 - 2 * t3; // simplified smoothstep
  },

  // Ease-in - slow start
  'ease-in': (t) => t * t * t,

  // Ease-out - slow end
  'ease-out': (t) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },

  // Ease-in-out - slow start and end
  'ease-in-out': (t) => {
    if (t < 0.5) {
      return 4 * t * t * t;
    } else {
      const t1 = 2 * t - 2;
      return 1 + t1 * t1 * t1 / 2;
    }
  },

  // Ease-in-back - anticipation
  'ease-in-back': (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },

  // Ease-out-back - overshoot
  'ease-out-back': (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const t1 = t - 1;
    return 1 + c3 * t1 * t1 * t1 + c1 * t1 * t1;
  },

  // Ease-in-out-back - anticipation and overshoot
  'ease-in-out-back': (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    if (t < 0.5) {
      const t2 = 2 * t;
      return (t2 * t2 * ((c2 + 1) * 2 * t - c2)) / 2;
    } else {
      const t2 = 2 * t - 2;
      return (t2 * t2 * ((c2 + 1) * t2 + c2) + 2) / 2;
    }
  },

  // Ease-in-bounce - bouncing start
  'ease-in-bounce': (t) => {
    return 1 - easingFunctions['ease-out-bounce'](1 - t);
  },

  // Ease-out-bounce - bouncing end
  'ease-out-bounce': (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      const t2 = t - 1.5 / d1;
      return n1 * t2 * t2 + 0.75;
    } else if (t < 2.5 / d1) {
      const t2 = t - 2.25 / d1;
      return n1 * t2 * t2 + 0.9375;
    } else {
      const t2 = t - 2.625 / d1;
      return n1 * t2 * t2 + 0.984375;
    }
  },

  // Ease-in-out-bounce - bouncing start and end
  'ease-in-out-bounce': (t) => {
    if (t < 0.5) {
      return (1 - easingFunctions['ease-out-bounce'](1 - 2 * t)) / 2;
    } else {
      return (1 + easingFunctions['ease-out-bounce'](2 * t - 1)) / 2;
    }
  },

  // Ease-in-elastic - elastic start
  'ease-in-elastic': (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },

  // Ease-out-elastic - elastic end
  'ease-out-elastic': (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  // Ease-in-out-elastic - elastic start and end
  'ease-in-out-elastic': (t) => {
    const c5 = (2 * Math.PI) / 4.5;
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) {
      return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
    } else {
      return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    }
  },

  // Steps - discrete steps (default to 10 steps)
  steps: (t, steps = 10) => {
    return Math.floor(t * steps) / steps;
  },

  // Sine - sinusoidal easing
  sine: (t) => {
    return 1 - Math.cos((t * Math.PI) / 2);
  },

  // Expo - exponential easing
  expo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, 10 * (t - 1));
  },

  // Circ - circular easing
  circ: (t) => {
    return 1 - Math.sqrt(1 - t * t);
  }
};

/**
 * Apply an easing function to a value t in [0, 1]
 * @param {string} easingName - Name of the easing function
 * @param {number} t - Value in [0, 1]
 * @param {number} steps - Number of steps for 'steps' easing (optional)
 * @returns {number} Eased value in [0, 1]
 */
export function applyEasing(easingName, t, steps) {
  if (!easingName || easingName === 'linear') {
    return t;
  }
  
  const easingFn = easingFunctions[easingName];
  if (!easingFn) {
    console.warn(`Unknown easing function: ${easingName}, using linear`);
    return t;
  }
  
  if (easingName === 'steps' && steps !== undefined) {
    return easingFn(t, steps);
  }
  
  return easingFn(t);
}

/**
 * Get list of all available easing function names
 * @returns {string[]} Array of easing function names
 */
export function getEasingNames() {
  return Object.keys(easingFunctions);
}
