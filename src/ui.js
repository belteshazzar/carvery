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
    rebuildAll,
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

  // Animation UI handlers
  document.getElementById('btnCompile').addEventListener('click', () => {
    const dsl = document.getElementById('animationDSL').value;
    try {
      animSystem.parse(dsl);

      console.log('Parsed animation:', animSystem);
      for (const [name, group] of animSystem.groups) {
        console.log(`Group: ${name}`, group);
        chunk.addGroup(name, group.bounds.min, group.bounds.max);
      }
      buildAllMeshes();

      state.groupNames = ["main", ...Array.from(animSystem.groups.keys())];
      updateGroupPanel();

    } catch(e) {
      console.error('Animation compile error:', e);
    }
  });

  document.getElementById('btnPlay').addEventListener('click', () => {
    animSystem.playing = true;
    setLastTime(performance.now());
  });

  document.getElementById('btnPause').addEventListener('click', () => {
    animSystem.playing = false;
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    animSystem.time = 0;
    animSystem.playing = false;
    animationTransforms.clear();
    rebuildAll();
  });

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
    rebuildAll();
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
            const nx = x + d[0]
            const ny = y + d[1]
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
}
