/**
 * UI event handlers and wiring
 * 
 * This module contains all UI event handlers that were previously in main.js.
 * It receives a state object with all necessary references and callbacks.
 */

/**
 * Initialize all UI event handlers
 * @param {Object} state - Object containing all necessary state and callbacks
 */
export function initializeUI(state) {
  const {
    // DOM elements
    canvas,
    
    // State variables
    chunk,
    N,
    palette,
    camera,
    animSystem,
    animationTransforms,
    
    getHoverVoxel,
    getHoverFace,
    setNeedsPick,
    getDragging,
    setDragging,
    getLastX,
    setLastX,
    getLastY,
    setLastY,
    setMouseX,
    setMouseY,



    
    // Functions
    exportToJSON,
    importFromJSON,
    decodePickAt,

  } = state;

  // Get DOM elements
  const xEl = document.getElementById('x');
  const yEl = document.getElementById('y');
  const zEl = document.getElementById('z');
  const fileInput = document.getElementById('fileInput');

  // Add side panel (menu) toggle handlers
  const sidePanel = document.querySelector('.side-panel');

  // Close panels on escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sidePanel.classList.contains('open')) {
        sidePanel.classList.remove('open');
      }
      if (animPanel.classList.contains('open')) {
        animPanel.classList.remove('open');
      }
    }
  });

  // Import/Export JSON
  document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
  
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = exportToJSON(); 
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'voxels.json'; 
    a.click();
    URL.revokeObjectURL(url);
  });
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result); 
        console.log('Importing JSON:', obj);
        importFromJSON(obj);
        updateAnimationList();
        updateGroupPanel();
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Update hover UI
  function updateHoverUI() {
    const hoverVoxel = getHoverVoxel();
    const hoverFace = getHoverFace();
    
    if (hoverVoxel < 0 || hoverFace < 0) {
      xEl.textContent = '-';
      yEl.textContent = '-';
      zEl.textContent = '-';
      return; 
    }
    const [x, y, z] = chunk.coordsOf(hoverVoxel);
    xEl.textContent = x;
    yEl.textContent = y;
    zEl.textContent = z;
  }

  // Export for use in render loop
  state.updateHoverUI = updateHoverUI;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Mouse event handlers
  canvas.addEventListener('mousedown', (e) => {
    canvas.focus();
    const pick = decodePickAt(e.clientX, e.clientY);
    
    // If clicking on empty space, auto-start camera rotation
    if (pick.voxel < 0 || pick.face < 0) {
      if (e.button === 0) {
        setDragging(true);
        setLastX(e.clientX);
        setLastY(e.clientY);
      }
      return;
    }

  });

  window.addEventListener('mouseup', () => { 
    setDragging(false);
  });

  window.addEventListener('mousemove', (e) => {
    const dragging = getDragging();
    
    if (!dragging) { 
      setMouseX(e.clientX);
      setMouseY(e.clientY);
      setNeedsPick(true); 
    }
    if (dragging) { 
      const lastX = getLastX();
      const lastY = getLastY();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY; 
      setLastX(e.clientX);
      setLastY(e.clientY); 
      const s = 0.005;
      camera.theta += dx * s;
      camera.phi -= dy * s;
      camera.clamp();
    }
  }, { passive: true });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = Math.pow(1.1, e.deltaY * 0.01);
    camera.radius *= z;
    camera.clamp();
  }, { passive: false });

  // Update the animation list UI
  function updateAnimationList() {
    const container = document.getElementById('animationList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Animations section
    if (state.animSystem.animations.size === 0 && state.animSystem.emitters.size === 0 && state.animSystem.sequences.size === 0) {
      container.innerHTML = '<p style="color: #888; font-size: 12px; margin: 8px 0;">No animations, emitters, or sequences defined</p>';
      return;
    }
    
    if (state.animSystem.animations.size > 0) {
      const animHeader = document.createElement('h5');
      animHeader.textContent = 'Animations';
      animHeader.style.margin = '8px 0 4px 0';
      container.appendChild(animHeader);
    }
    
    for (const [name, anim] of state.animSystem.animations.entries()) {
      const item = document.createElement('div');
      item.className = 'animation-item';
      
      const info = document.createElement('div');
      info.className = 'animation-info';
      
      const nameLabel = document.createElement('span');
      nameLabel.className = 'animation-name';
      nameLabel.textContent = name;
      
      const groupLabel = document.createElement('span');
      groupLabel.className = 'animation-group';
      groupLabel.textContent = anim.groupName || 'no group';
      
      if (anim.loop) {
        const loopBadge = document.createElement('span');
        loopBadge.className = 'animation-badge';
        loopBadge.textContent = 'loop';
        info.appendChild(loopBadge);
      }
      
      info.appendChild(nameLabel);
      info.appendChild(groupLabel);
      
      const controls = document.createElement('div');
      controls.className = 'animation-controls-inline';
      
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶';
      playBtn.title = 'Play';
      playBtn.className = 'animation-btn';
      playBtn.addEventListener('click', () => {
        state.animSystem.playAnimation(name);
      });
      
      const stopBtn = document.createElement('button');
      stopBtn.textContent = '⏹';
      stopBtn.title = 'Stop';
      stopBtn.className = 'animation-btn';
      stopBtn.addEventListener('click', () => {
        state.animSystem.stopAnimation(name);
      });
      
      const resetBtn = document.createElement('button');
      resetBtn.textContent = '↺';
      resetBtn.title = 'Reset';
      resetBtn.className = 'animation-btn';
      resetBtn.addEventListener('click', () => {
        state.animSystem.resetAnimation(name);
      });
      
      controls.appendChild(playBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(resetBtn);
      
      item.appendChild(info);
      item.appendChild(controls);
      container.appendChild(item);
    }
    
    // Emitters section
    if (state.animSystem.emitters.size > 0) {
      const emitterHeader = document.createElement('h5');
      emitterHeader.textContent = 'Emitters';
      emitterHeader.style.margin = '12px 0 4px 0';
      container.appendChild(emitterHeader);
      
      for (const [name, emitter] of state.animSystem.emitters.entries()) {
        const item = document.createElement('div');
        item.className = 'animation-item';
        
        const info = document.createElement('div');
        info.className = 'animation-info';
        
        const nameLabel = document.createElement('span');
        nameLabel.className = 'animation-name';
        nameLabel.textContent = name;
        
        const statusLabel = document.createElement('span');
        statusLabel.className = 'animation-group';
        statusLabel.textContent = emitter.enabled ? 'active' : 'stopped';
        
        const particleCount = document.createElement('span');
        particleCount.className = 'animation-badge';
        particleCount.textContent = `${emitter.particles.length} particles`;
        
        info.appendChild(nameLabel);
        info.appendChild(particleCount);
        info.appendChild(statusLabel);
        
        const controls = document.createElement('div');
        controls.className = 'animation-controls-inline';
        
        const startBtn = document.createElement('button');
        startBtn.textContent = '▶';
        startBtn.title = 'Start';
        startBtn.className = 'animation-btn';
        startBtn.addEventListener('click', () => {
          state.animSystem.startEmitter(name);
        });
        
        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⏹';
        stopBtn.title = 'Stop';
        stopBtn.className = 'animation-btn';
        stopBtn.addEventListener('click', () => {
          state.animSystem.stopEmitter(name);
        });
        
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '✕';
        clearBtn.title = 'Clear particles';
        clearBtn.className = 'animation-btn';
        clearBtn.addEventListener('click', () => {
          state.animSystem.clearEmitter(name);
        });
        
        controls.appendChild(startBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(clearBtn);
        
        item.appendChild(info);
        item.appendChild(controls);
        container.appendChild(item);
      }
    }

    // Sequences section
    if (state.animSystem.sequences.size > 0) {
      const sequenceHeader = document.createElement('h5');
      sequenceHeader.textContent = 'Sequences';
      sequenceHeader.style.margin = '12px 0 4px 0';
      container.appendChild(sequenceHeader);
      
      for (const [name, sequence] of state.animSystem.sequences.entries()) {
        const item = document.createElement('div');
        item.className = 'animation-item';
        
        const info = document.createElement('div');
        info.className = 'animation-info';
        
        const nameLabel = document.createElement('span');
        nameLabel.className = 'animation-name';
        nameLabel.textContent = name;
        
        const countBadge = document.createElement('span');
        countBadge.className = 'animation-badge';
        const totalCount = sequence.animationNames.length + sequence.emitterNames.length;
        countBadge.textContent = `${totalCount} items`;
        
        const detailsLabel = document.createElement('span');
        detailsLabel.className = 'animation-group';
        const details = [];
        if (sequence.animationNames.length > 0) {
          details.push(`${sequence.animationNames.length} anim${sequence.animationNames.length !== 1 ? 's' : ''}`);
        }
        if (sequence.emitterNames.length > 0) {
          details.push(`${sequence.emitterNames.length} emitter${sequence.emitterNames.length !== 1 ? 's' : ''}`);
        }
        detailsLabel.textContent = details.join(', ');
        
        info.appendChild(nameLabel);
        info.appendChild(countBadge);
        info.appendChild(detailsLabel);
        
        const controls = document.createElement('div');
        controls.className = 'animation-controls-inline';
        
        const playBtn = document.createElement('button');
        playBtn.textContent = '▶';
        playBtn.title = 'Play sequence';
        playBtn.className = 'animation-btn';
        playBtn.addEventListener('click', () => {
          state.animSystem.playSequence(name);
        });
        
        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⏹';
        stopBtn.title = 'Stop sequence';
        stopBtn.className = 'animation-btn';
        stopBtn.addEventListener('click', () => {
          state.animSystem.stopSequence(name);
        });
        
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset sequence';
        resetBtn.className = 'animation-btn';
        resetBtn.addEventListener('click', () => {
          state.animSystem.resetSequence(name);
        });
        
        controls.appendChild(playBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(resetBtn);
        
        item.appendChild(info);
        item.appendChild(controls);
        container.appendChild(item);
      }
    }
  }

  // Update the group list UI
  function updateGroupPanel() {
    const container = document.getElementById('groupList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.animSystem.groups.size === 0) {
      container.innerHTML = '<p style="color: #888; font-size: 12px; margin: 8px 0;">No groups defined</p>';
      return;
    }
    
    if (state.animSystem.animations.size > 0) {
      const animHeader = document.createElement('h5');
      animHeader.textContent = 'Groups';
      animHeader.style.margin = '8px 0 4px 0';
      container.appendChild(animHeader);
    }

    const groupOverlays = state.getGroupOverlaysVisible();
    const selectedGroup = state.getSelectedGroupName();
    
    for (const [name, group] of state.animSystem.groups.entries()) {
      const item = document.createElement('div');
      item.className = 'group-item';
      if (selectedGroup === name) {
        item.classList.add('selected');
      }
      
      // Header with name and toggle
      const header = document.createElement('div');
      header.className = 'group-header';
      
      const nameLabel = document.createElement('span');
      nameLabel.className = 'group-name';
      nameLabel.textContent = name;
      
      const toggle = document.createElement('div');
      toggle.className = 'group-toggle';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `group-vis-${name}`;
      checkbox.checked = groupOverlays.get(name) || false;
      checkbox.addEventListener('change', (e) => {
        groupOverlays.set(name, e.target.checked);
        if (e.target.checked) {
          state.setSelectedGroupName(name);
          updateGroupPanel();
        }
      });
      
      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = `group-vis-${name}`;
      checkboxLabel.textContent = 'Show';
      
      toggle.appendChild(checkbox);
      toggle.appendChild(checkboxLabel);
      
      header.appendChild(nameLabel);
      header.appendChild(toggle);
      
      // Bounds inputs
      const boundsContainer = document.createElement('div');
      boundsContainer.className = 'group-bounds';
      
      // Min column
      const minCol = document.createElement('div');
      minCol.className = 'bounds-col';
      
      const minLabel = document.createElement('div');
      minLabel.className = 'bounds-label';
      minLabel.textContent = 'Min';
      minCol.appendChild(minLabel);
      
      ['x', 'y', 'z'].forEach((axis, idx) => {
        const row = document.createElement('div');
        row.className = 'bounds-row';
        
        const label = document.createElement('label');
        label.textContent = axis.toUpperCase();
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '15';
        input.value = group.min[idx];
        input.addEventListener('change', (e) => {
          const val = Math.max(0, Math.min(15, parseInt(e.target.value) || 0));
          group.min[idx] = val;
          e.target.value = val;
          
          // Update chunk groups and rebuild meshes
          state.chunk.clearGroups();
          state.animSystem.groups.forEach((g, n) => {
            state.chunk.addGroup(n, g.min, g.max);
          });
          state.animSystem.assignVoxelsToGroups(state.chunk);
          state.buildAllMeshes();
        });
        
        row.appendChild(label);
        row.appendChild(input);
        minCol.appendChild(row);
      });
      
      // Max column
      const maxCol = document.createElement('div');
      maxCol.className = 'bounds-col';
      
      const maxLabel = document.createElement('div');
      maxLabel.className = 'bounds-label';
      maxLabel.textContent = 'Max';
      maxCol.appendChild(maxLabel);
      
      ['x', 'y', 'z'].forEach((axis, idx) => {
        const row = document.createElement('div');
        row.className = 'bounds-row';
        
        const label = document.createElement('label');
        label.textContent = axis.toUpperCase();
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '15';
        input.value = group.max[idx];
        input.addEventListener('change', (e) => {
          const val = Math.max(0, Math.min(15, parseInt(e.target.value) || 0));
          group.max[idx] = val;
          e.target.value = val;
          
          // Update chunk groups and rebuild meshes
          state.chunk.clearGroups();
          state.animSystem.groups.forEach((g, n) => {
            state.chunk.addGroup(n, g.min, g.max);
          });
          state.animSystem.assignVoxelsToGroups(state.chunk);
          state.buildAllMeshes();
        });
        
        row.appendChild(label);
        row.appendChild(input);
        maxCol.appendChild(row);
      });
      
      boundsContainer.appendChild(minCol);
      boundsContainer.appendChild(maxCol);
      
      item.appendChild(header);
      item.appendChild(boundsContainer);
      container.appendChild(item);
    }
  }

  // Play all looping animations and start all emitters
  document.getElementById('btnPlay')?.addEventListener('click', () => {
    for (const [name, anim] of state.animSystem.animations.entries()) {
      if (anim.loop) {
        state.animSystem.playAnimation(name);
      }
    }
    for (const [name, emitter] of state.animSystem.emitters.entries()) {
      state.animSystem.startEmitter(name);
    }
  });

  // Pause all animations and stop all emitters
  document.getElementById('btnPause')?.addEventListener('click', () => {
    for (const anim of state.animSystem.animations.values()) {
      anim.stop();
    }
    for (const emitter of state.animSystem.emitters.values()) {
      emitter.stop();
    }
  });

  // Reset all animations, emitters, and sequences
  document.getElementById('btnResetAll')?.addEventListener('click', () => {
    state.animSystem.resetAll();
  });
}
