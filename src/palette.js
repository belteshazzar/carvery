/**
 * Converts a hex color string to RGB float array.
 * 
 * @param {string} hex Color in hex format (#RRGGBB)
 * @returns {number[]} Array of [r,g,b] floats in range [0,1]
 */
export const hexToRgbF = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
};

/**
 * Converts a decimal value to 2-digit hex.
 * 
 * @param {number} x Decimal value (0-1)
 * @returns {string} 2-digit hex string
 */
export const decToHex = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2);

/**
 * Converts RGB floats to hex color string.
 * 
 * @param {number} r Red component (0-1)
 * @param {number} g Green component (0-1) 
 * @param {number} b Blue component (0-1)
 * @returns {string} Color in hex format (#RRGGBB)
 */
export const rgbToHexF = (r, g, b) => {
  return '#' + decToHex(r) + decToHex(g) + decToHex(b);
};

/**
 * Default palette colors.
 */
export const defaultPaletteHex = [
  '#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', 
  '#264653', '#a8dadc', '#457b9d', '#1d3557',
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', 
  '#b983ff', '#ff4d6d', '#9ef01a', '#00f5d4'
];

/**
 * Creates and initializes a new palette.
 * 
 * @returns {Float32Array} Palette array of RGB values
 */
export function createPalette() {
  const palette = new Float32Array(16 * 3);
  for (let i = 0; i < 16; i++) {
    const [r, g, b] = hexToRgbF(defaultPaletteHex[i]);
    setPaletteColor(palette, i, [r, g, b]);
  }
  return palette;
}

/**
 * Sets a color in the palette.
 * 
 * @param {Float32Array} palette Palette array
 * @param {number} i Index (0-15)
 * @param {number[]} rgb RGB color array [r,g,b]
 */
export function setPaletteColor(palette, i, rgb) {
  palette[i * 3 + 0] = rgb[0];
  palette[i * 3 + 1] = rgb[1];
  palette[i * 3 + 2] = rgb[2];
}

/**
 * Builds and manages the palette UI
 */
export class PaletteUI {
  /**
   * @param {HTMLElement} container Container element for palette UI
   * @param {Float32Array} palette Palette data
   * @param {Function} onBrushChange Callback when brush selection changes
   * @param {Function} onColorChange Callback when color changes with undo data
   */
  constructor(container, palette, onBrushChange, onColorChange) {
    this.container = container;
    this.palette = palette;
    this.onBrushChange = onBrushChange;
    this.onColorChange = onColorChange;
    this.brushMat = 0;
    this.pickers = new Map(); // Store pickers for each swatch
    this.build();
  }

  /**
   * Rebuilds the entire palette UI
   */
  build() {
    this.container.innerHTML = '';
    this.pickers.clear();
    
    for (let i = 0; i < 16; i++) {
      const hex = rgbToHexF(
        this.palette[i * 3 + 0], 
        this.palette[i * 3 + 1], 
        this.palette[i * 3 + 2]
      );

      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      if (i === this.brushMat) swatch.classList.add('active');
      swatch.title = `Left click: Select material ${i}\n${navigator.platform.includes('Mac') ? 'Control+click' : 'Right click'}: Edit color`;

      const idx = document.createElement('div');
      idx.className = 'idx';
      idx.textContent = i.toString(16).toUpperCase();

      const color = document.createElement('div');
      color.className = 'color';
      color.style.background = hex;

      // Create hidden color picker
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = hex;
      picker.disabled = true;
      this.pickers.set(i, picker);

      // Handle color picker opening
      const openColorPicker = (e) => {
        e.preventDefault();
        let lastHex = hex;
        
        const onPickerChange = () => {
          const newHex = picker.value;
          const [r, g, b] = hexToRgbF(newHex);
          setPaletteColor(this.palette, i, [r, g, b]);
          color.style.background = newHex;
          
          if (newHex !== lastHex) {
            this.onColorChange(i, lastHex, newHex);
            lastHex = newHex;
          }

          picker.disabled = true;
        };

        picker.addEventListener('input', onPickerChange);
        picker.addEventListener('change', () => {
          picker.removeEventListener('input', onPickerChange);
        }, { once: true });
        
        picker.disabled = false;
        picker.showPicker();
      };

      // Left click to select brush
      swatch.addEventListener('click', (e) => {
        if (!e.ctrlKey) {
          this.selectBrush(i);
        }
      });

      // Right click or Control+click to open color picker
      swatch.addEventListener('contextmenu', openColorPicker);

      swatch.appendChild(idx);
      swatch.appendChild(picker);
      swatch.appendChild(color);
      this.container.appendChild(swatch);
    }

  }

  /**
   * Updates brush selection.
   * 
   * @param {number} id New brush material ID
   */
  selectBrush(id) {
    this.brushMat = id & 15;
    
    this.container.querySelectorAll('.swatch').forEach(s => 
      s.classList.remove('active')
    );
    
    const swatches = this.container.querySelectorAll('.swatch');
    if (swatches[this.brushMat]) {
      swatches[this.brushMat].classList.add('active');
    }

    if (this.onBrushChange) {
      this.onBrushChange(this.brushMat);
    }
  }

  /**
   * Gets current brush material
   */
  getBrush() {
    return this.brushMat;
  }
}