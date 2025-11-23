/**
 * ShiftButtonGroup Web Component
 * 
 * A reusable component for increment/decrement controls with a label and value display.
 * 
 * Attributes:
 * - axis: 'x', 'y', 'z', or custom label class
 * - value: The current numeric value
 * - step: Increment/decrement step (default: 1)
 * - min: Minimum value (optional)
 * - max: Maximum value (optional)
 * - label: Custom label text (optional, overrides axis)
 * 
 * Events:
 * - change: Fired when value changes, detail contains { value, oldValue }
 * 
 * Usage:
 * <shift-button-group axis="x" value="5" step="1" min="0" max="255"></shift-button-group>
 */
export class ShiftButtonGroup extends HTMLElement {
  constructor() {
    super();
    this._value = 0;
    this._step = 1;
    this._min = null;
    this._max = null;
  }

  static get observedAttributes() {
    return ['axis', 'value', 'step', 'min', 'max', 'label'];
  }

  connectedCallback() {
    this.className = 'shift-button-group';
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'value':
        this._value = parseFloat(newValue) || 0;
        break;
      case 'step':
        this._step = parseFloat(newValue) || 1;
        break;
      case 'min':
        this._min = newValue !== null ? parseFloat(newValue) : null;
        break;
      case 'max':
        this._max = newValue !== null ? parseFloat(newValue) : null;
        break;
    }
    
    if (this.isConnected) {
      this.render();
    }
  }

  get value() {
    return this._value;
  }

  set value(val) {
    const oldValue = this._value;
    this._value = parseFloat(val) || 0;
    this.setAttribute('value', this._value);
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this._value, oldValue }
    }));
  }

  increment() {
    const oldValue = this._value;
    let newValue = this._value + this._step;
    
    // Handle floating point precision for decimal steps
    if (this._step < 1) {
      newValue = Math.round(newValue * 10) / 10;
    }
    
    if (this._max !== null) {
      newValue = Math.min(newValue, this._max);
    }
    
    this._value = newValue;
    this.setAttribute('value', this._value);
    this.render();
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this._value, oldValue }
    }));
  }

  decrement() {
    const oldValue = this._value;
    let newValue = this._value - this._step;
    
    // Handle floating point precision for decimal steps
    if (this._step < 1) {
      newValue = Math.round(newValue * 10) / 10;
    }
    
    if (this._min !== null) {
      newValue = Math.max(newValue, this._min);
    }
    
    this._value = newValue;
    this.setAttribute('value', this._value);
    this.render();
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this._value, oldValue }
    }));
  }

  render() {
    const axis = this.getAttribute('axis');
    const customLabel = this.getAttribute('label');
    
    this.innerHTML = '';
    
    // Minus button
    const minusBtn = document.createElement('button');
    minusBtn.className = 'shift-btn shift-minus';
    minusBtn.textContent = '−';
    minusBtn.title = `Decrease by ${this._step}`;
    minusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.decrement();
    });
    
    // Label with value
    const label = document.createElement('span');
    label.className = axis ? `shift-label shift-${axis}` : 'shift-label';
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'shift-value';
    
    // Format value based on step size
    if (this._step < 1) {
      valueSpan.textContent = this._value.toFixed(1);
    } else {
      valueSpan.textContent = this._value;
    }
    
    label.appendChild(valueSpan);
    
    // Plus button
    const plusBtn = document.createElement('button');
    plusBtn.className = 'shift-btn shift-plus';
    plusBtn.textContent = '+';
    plusBtn.title = `Increase by ${this._step}`;
    plusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.increment();
    });
    
    this.appendChild(minusBtn);
    this.appendChild(label);
    this.appendChild(plusBtn);
  }
}

// Register the custom element
customElements.define('shift-button-group', ShiftButtonGroup);
