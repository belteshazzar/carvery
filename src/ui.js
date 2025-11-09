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
    
    // State getters/setters
    getMode,
    setMode,
    getOption,
    setOption,
    getHoverVoxel,
    setHoverVoxel,
    getHoverFace,
    setHoverFace,
    setNeedsPick,
    getDragging,
    setDragging,
    getLastX,
    setLastX,
    getLastY,
    setLastY,
    getMouseX,
    setMouseX,
    getMouseY,
    setMouseY,
    getLastTime,
    setLastTime,
    getRowHoverSurf,
    setRowHoverSurf,
    getRowHoverAdd,
    setRowHoverAdd,
    getPlaneHoverSurf,
    setPlaneHoverSurf,
    getPlaneHoverAdd,
    setPlaneHoverAdd,
    
    // Functions
    buildAllMeshes,
    clearHistory,
    undo,
    redo,
    exportToJSON,
    importFromJSON,
    decodePickAt,
    getRowSurfaceVoxels,
    getRowAddTargets,
    getPlaneSurfaceVoxels,
    getPlaneAddTargets,
    beginVoxelAction,
    recordVoxelChange,
    commitAction,
    updateGroupPanel,
    
    // Constants
    FACE_DIRS
  } = state;

  // Get DOM elements
  const xEl = document.getElementById('x');
  const yEl = document.getElementById('y');
  const zEl = document.getElementById('z');
  const undoBtn = document.getElementById('btnUndo');
  const redoBtn = document.getElementById('btnRedo');
  const fileInput = document.getElementById('fileInput');

  // Add panel toggle handlers
  const animPanel = document.querySelector('.animation-panel');
  const btnToggleAnimations = document.getElementById('btnToggleAnimations');
  const btnCloseAnimations = document.getElementById('btnCloseAnimations');

  btnToggleAnimations.addEventListener('click', () => {
    animPanel.classList.toggle('open');
  });

  btnCloseAnimations.addEventListener('click', () => {
    animPanel.classList.remove('open');
  });

  // Optional: Close on escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && animPanel.classList.contains('open')) {
      animPanel.classList.remove('open');
    }
  });

  // // Animation UI handlers
  // document.getElementById('btnCompile').addEventListener('click', () => {
  //   const dsl = document.getElementById('animationDSL').value;
  //   try {

  //     animSystem.parse(dsl);

  //     chunk.clearGroups();
  //     animSystem.groups.forEach((group,name) => {
  //       chunk.addGroup(name, group.min, group.max);
  //     });
  //     buildAllMeshes();
  //     updateTriggerSelect();

  //   } catch(e) {
  //     console.error('Animation compile error:', e);
  //   }
  // });

  // // Update the trigger select dropdown to show animations instead of groups
  // function updateTriggerSelect() {
  //   const select = document.getElementById('triggerSelect');
  //   select.innerHTML = '<option value="">Trigger animation...</option>';
    
  //   for (const [name, anim] of animSystem.animations.entries()) {
  //     const option = document.createElement('option');
  //     option.value = name;
  //     option.textContent = `${name} (${anim.groupName || 'no group'})`;
  //     select.appendChild(option);
  //   }
  // }

  // document.getElementById('btnPlay').addEventListener('click', () => {
  //   animSystem.playing = true;
  //   setLastTime(performance.now());
  // });

  // document.getElementById('btnPause').addEventListener('click', () => {
  //   animSystem.playing = false;
  // });

  // // Handle dropdown selection to trigger individual animations
  // document.getElementById('triggerSelect').addEventListener('change', (e) => {
  //   const animName = e.target.value;
  //   if (animName) {
  //     animSystem.playAnimation(animName);
  //     e.target.value = ''; // Reset dropdown
  //   }
  // });

  // document.getElementById('btnReset').addEventListener('click', () => {
  //   animSystem.reset();
  // });


  // Mode selection
  document.querySelectorAll('input[name="modeSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setMode(e.target.value);
      }
    });
  });

  // Option selection
  document.querySelectorAll('input[name="optionSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setOption(e.target.value);
      }
    });
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
        importFromJSON(obj);
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Reset button
  document.getElementById('resetSolid').addEventListener('click', () => {
    chunk.fill(true);
    chunk.seedMaterials('bands');
    buildAllMeshes();
    clearHistory();
  });

  // Undo/Redo buttons
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

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

  // Keyboard event handler
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    // Mode shortcuts
    if (k === 'q') {
      document.getElementById('modePaint').checked = true;
      setMode('paint');
      return;
    }
    
    if (k === 'w') {
      document.getElementById('modeCarve').checked = true;
      setMode('carve');
      return;
    }
    
    if (k === 's') {
      document.getElementById('modeAdd').checked = true;
      setMode('add');
      return;
    }

    if (!e.ctrlKey && k === 'v') {
      document.getElementById('optionVoxel').checked = true;
      setOption('voxel');
      return;
    }

    if (k === 'r') {
      document.getElementById('optionRow').checked = true;
      setOption('row');
      return;
    }

    if (k === 'p') {
      document.getElementById('optionPlane').checked = true;
      setOption('plane');
      return;
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'z')) {
      e.preventDefault();
      undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && (k === 'z')))) {
      e.preventDefault();
      redo();
      return;
    }
  
    // Quick material: 0-9, A-F
    if (/^[0-9]$/.test(k)) palette.selectBrush(parseInt(k, 10));
    else if (/^[a-f]$/i.test(k)) palette.selectBrush(10 + parseInt(k, 16) - 10);

    setNeedsPick(true);
  });

  window.addEventListener('keyup', (e) => {
    setNeedsPick(true);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Mouse event handlers
  canvas.addEventListener('mousedown', (e) => {
    canvas.focus();
    const pick = decodePickAt(e.clientX, e.clientY);
    const mode = getMode();
    const option = getOption();
    
    // If clicking on empty space, auto-start camera rotation
    if (pick.voxel < 0 || pick.face < 0) {
      if (e.button === 0) {
        setDragging(true);
        setLastX(e.clientX);
        setLastY(e.clientY);
      }
      return;
    }

    if (e.button === 0 && mode === 'paint') {
      // Paint
      if (option == 'plane') {
        const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
        if (arr.length > 0) {
          const act = beginVoxelAction('Paint plane');
          for (const id of arr) recordVoxelChange(act, id, true, palette.getBrush());
          commitAction(act);
        }
      } else if (option == 'row') {
        const arr = getRowSurfaceVoxels(pick.voxel, pick.face);
        if (arr.length > 0) {
          const act = beginVoxelAction(`Paint row`);
          for (const id of arr) recordVoxelChange(act, id, true, palette.getBrush());
          commitAction(act);
        }
      } else if (pick.voxel >= 0) {
        const id = chunk.idx3(...chunk.coordsOf(pick.voxel));
        if (chunk.isSolid(id)) {
          const act = beginVoxelAction('Paint voxel');
          recordVoxelChange(act, pick.voxel, true, palette.getBrush());
          commitAction(act);
        }
      }
    } else if (e.button === 0 && mode === 'add') {
        // Add
        if (option == 'plane') {
          const targets = getPlaneAddTargets(pick.voxel, pick.face);
          if (targets.length > 0) {
            const act = beginVoxelAction('Add plane');
            for (const t of targets) recordVoxelChange(act, t, true, palette.getBrush());
            commitAction(act);
          }
        } else if (option == 'row') {
          const targets = getRowAddTargets(pick.voxel, pick.face);
          if (targets.length > 0) {
            const act = beginVoxelAction(`Add row`);
            for (const t of targets) recordVoxelChange(act, t, true, palette.getBrush());
            commitAction(act);
          }
        } else if (pick.voxel >= 0 && pick.face >= 0) {
            const [x, y, z] = chunk.coordsOf(pick.voxel);
            const d = FACE_DIRS[pick.face];
            const nx = x + d[0];
            const ny = y + d[1];
            const nz = z + d[2];
            if (chunk.within(nx, ny, nz)) {
              const id = chunk.idx3(nx, ny, nz);
              if (!chunk.isSolid(id)) {
                const act = beginVoxelAction('Add voxel');
                recordVoxelChange(act, id, true, palette.getBrush());
                commitAction(act);
              }
            }
        }

        setNeedsPick(true);

      } else if (e.button === 0 && mode === 'carve') {
        // Remove (or toggle for single)
        if (option == 'plane') {
          const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
          const act = beginVoxelAction('Remove plane');
          for (const id of arr) recordVoxelChange(act, id, false, chunk.material(id));
          commitAction(act);
        } else if (option == 'row') {
          const arr = getRowSurfaceVoxels(pick.voxel, pick.face);
          const act = beginVoxelAction(`Remove row`);
          for (const id of arr) recordVoxelChange(act, id, false, chunk.material(id));
          commitAction(act);
        } else if (pick.voxel >= 0 && chunk.isSolid(pick.voxel)) {
            const act = beginVoxelAction('Remove voxel');
            recordVoxelChange(act, pick.voxel, false, chunk.material(pick.voxel)); // keep existing mat on toggle
            commitAction(act);
        }

        setNeedsPick(true);
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
    
    if (state.animSystem.animations.size === 0) {
      container.innerHTML = '<p style="color: #888; font-size: 12px; margin: 8px 0;">No animations defined</p>';
      return;
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
      resetBtn.textContent = '⏮';
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
  }

  // Compile button
  document.getElementById('btnCompile')?.addEventListener('click', () => {
    const dsl = document.getElementById('animationDSL').value;
    try {
      state.animSystem.parse(dsl);
      state.animSystem.assignVoxelsToGroups(state.chunk);

      state.chunk.clearGroups();
      state.animSystem.groups.forEach((group,name) => {
        state.chunk.addGroup(name, group.min, group.max);
      });
      state.buildAllMeshes();

      updateAnimationList();
      // updateGroupPanel();
    } catch(e) {
      console.error('Animation compile error:', e);
      alert('Animation compile error: ' + e.message);
    }
  });

  // Play all looping animations
  document.getElementById('btnPlay')?.addEventListener('click', () => {
    for (const [name, anim] of state.animSystem.animations.entries()) {
      if (anim.loop) {
        state.animSystem.playAnimation(name);
      }
    }
  });

  // Pause all animations
  document.getElementById('btnPause')?.addEventListener('click', () => {
    for (const anim of state.animSystem.animations.values()) {
      anim.stop();
    }
  });

  // Reset all animations
  document.getElementById('btnResetAll')?.addEventListener('click', () => {
    state.animSystem.resetAll();
  });
}
