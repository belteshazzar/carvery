/**
 * XYZ Control Web Component
 * Combines three ShiftButtonGroup elements for x, y, z coordinate editing.
 */
class XYZControl extends HTMLElement {
  static get observedAttributes() {
    return ['x', 'y', 'z', 'step', 'min', 'max'];
  }

  constructor() {
    super();
    this._x = 0;
    this._y = 0;
    this._z = 0;
    this._step = 1;
    this._min = -Infinity;
    this._max = Infinity;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'x':
        this._x = parseFloat(newValue) || 0;
        break;
      case 'y':
        this._y = parseFloat(newValue) || 0;
        break;
      case 'z':
        this._z = parseFloat(newValue) || 0;
        break;
      case 'step':
        this._step = parseFloat(newValue) || 1;
        break;
      case 'min':
        this._min = newValue !== null ? parseFloat(newValue) : -Infinity;
        break;
      case 'max':
        this._max = newValue !== null ? parseFloat(newValue) : Infinity;
        break;
    }

    if (this.isConnected) {
      this.render();
    }
  }

  get values() {
    return [this._x, this._y, this._z];
  }

  set values(arr) {
    if (Array.isArray(arr) && arr.length === 3) {
      this._x = arr[0];
      this._y = arr[1];
      this._z = arr[2];
      this.render();
    }
  }

  render() {
    this.innerHTML = '';
    this.style.display = 'flex';
    this.style.gap = '8px';

    ['x', 'y', 'z'].forEach((axis, idx) => {
      const value = [this._x, this._y, this._z][idx];
      const control = document.createElement('shift-button-group');
      control.setAttribute('axis', axis);
      control.setAttribute('value', value);
      control.setAttribute('step', this._step);
      if (this._min !== -Infinity) {
        control.setAttribute('min', this._min);
      }
      if (this._max !== Infinity) {
        control.setAttribute('max', this._max);
      }

      control.addEventListener('change', (e) => {
        const oldValues = [this._x, this._y, this._z];
        if (idx === 0) this._x = e.detail.value;
        if (idx === 1) this._y = e.detail.value;
        if (idx === 2) this._z = e.detail.value;

        // Dispatch custom event with all three values
        this.dispatchEvent(new CustomEvent('change', {
          detail: {
            values: [this._x, this._y, this._z],
            oldValues,
            axis,
            index: idx
          }
        }));
      });

      this.appendChild(control);
    });
  }
}

customElements.define('xyz-control', XYZControl);
