/**
 * Simple test to verify all easing functions work correctly
 * This is not a formal test suite, just a verification that the functions exist and return valid values
 */

import { easingFunctions, applyEasing, getEasingNames } from '../src/easing.js';

console.log('Testing Easing Functions...\n');

// Test that all expected easing functions exist
const expectedFunctions = [
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
  'ease-in-back', 'ease-out-back', 'ease-in-out-back',
  'ease-in-bounce', 'ease-out-bounce', 'ease-in-out-bounce',
  'ease-in-elastic', 'ease-out-elastic', 'ease-in-out-elastic',
  'steps', 'sine', 'expo', 'circ'
];

const availableFunctions = getEasingNames();
console.log(`✓ Available easing functions: ${availableFunctions.length}`);

let allPresent = true;
expectedFunctions.forEach(name => {
  if (!availableFunctions.includes(name)) {
    console.error(`✗ Missing easing function: ${name}`);
    allPresent = false;
  }
});

if (allPresent) {
  console.log('✓ All expected easing functions are present\n');
}

// Test that easing functions return valid values in [0, 1] range
console.log('Testing value ranges (t=0 should return 0, t=1 should return 1)...');
let allValid = true;

for (const name of expectedFunctions) {
  if (name === 'steps') continue; // Steps is special case
  
  const v0 = applyEasing(name, 0);
  const v1 = applyEasing(name, 1);
  const vMid = applyEasing(name, 0.5);
  
  // Check endpoints
  if (Math.abs(v0 - 0) > 0.001) {
    console.error(`✗ ${name}: t=0 returned ${v0}, expected ~0`);
    allValid = false;
  }
  if (Math.abs(v1 - 1) > 0.001) {
    console.error(`✗ ${name}: t=1 returned ${v1}, expected ~1`);
    allValid = false;
  }
  
  // Check mid-point returns a valid number
  if (isNaN(vMid)) {
    console.error(`✗ ${name}: t=0.5 returned NaN`);
    allValid = false;
  }
}

// Test steps easing with custom step count
const steps5 = applyEasing('steps', 0.5, 5);
if (typeof steps5 === 'number' && !isNaN(steps5)) {
  console.log('✓ Steps easing with custom count works');
} else {
  console.error('✗ Steps easing failed');
  allValid = false;
}

if (allValid) {
  console.log('✓ All easing functions return valid values\n');
}

// Test unknown easing function fallback to linear
const unknown = applyEasing('unknown-easing', 0.5);
if (unknown === 0.5) {
  console.log('✓ Unknown easing function correctly falls back to linear\n');
} else {
  console.error('✗ Unknown easing function did not fall back to linear');
}

// Sample output for a few functions
console.log('Sample easing curves (t=0.0, 0.25, 0.5, 0.75, 1.0):');
const sampleFunctions = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'ease-out-bounce'];
for (const name of sampleFunctions) {
  const values = [0, 0.25, 0.5, 0.75, 1.0].map(t => applyEasing(name, t).toFixed(3));
  console.log(`  ${name.padEnd(20)}: [${values.join(', ')}]`);
}

console.log('\n✓ Easing functions test complete!');
