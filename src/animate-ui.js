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
        updateEmitterList();
        updateSequenceList();
        updateRegionPanel();
        
        // Show all controls now that file is loaded
        const animPanel = document.querySelector('.animation-panel');
        if (animPanel) {
          animPanel.setAttribute('data-loaded', 'true');
        }
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
        console.error('Error importing JSON:', err);
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
    
    // Add "Add Animation" button at the top
    const addAnimBtn = document.createElement('button');
    addAnimBtn.textContent = '+ Add Animation';
    addAnimBtn.className = 'add-animation-btn';
    addAnimBtn.addEventListener('click', () => {
      const newName = state.animSystem.generateUniqueAnimationName('anim');
      // Create animation without a region initially
      state.animSystem.addAnimation(newName, null);
      updateAnimationList();
    });
    container.appendChild(addAnimBtn);
    
    // Animations section
    if (state.animSystem.animations.size === 0 && state.animSystem.emitters.size === 0 && state.animSystem.sequences.size === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontSize = '12px';
      emptyMsg.style.margin = '8px 0';
      emptyMsg.textContent = 'No animations, emitters, or sequences defined';
      container.appendChild(emptyMsg);
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
      item.className = 'animation-item expanded';
      
      // Header section
      const header = document.createElement('div');
      header.className = 'animation-header';
      
      const headerLeft = document.createElement('div');
      headerLeft.className = 'animation-header-left';
      
      const nameLabel = document.createElement('span');
      nameLabel.className = 'animation-name';
      nameLabel.textContent = name;
      headerLeft.appendChild(nameLabel);
      
      if (anim.loop) {
        const loopBadge = document.createElement('span');
        loopBadge.className = 'animation-badge';
        loopBadge.textContent = 'loop';
        headerLeft.appendChild(loopBadge);
      }
      
      const headerRight = document.createElement('div');
      headerRight.className = 'animation-header-right';
      
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
      
      const duplicateBtn = document.createElement('button');
      duplicateBtn.textContent = '⎘';
      duplicateBtn.title = 'Duplicate animation';
      duplicateBtn.className = 'animation-btn keyframe-duplicate-btn';
      duplicateBtn.addEventListener('click', () => {
        const newName = state.animSystem.generateUniqueAnimationName(name);
        const newAnim = state.animSystem.addAnimation(newName, anim.regionName);
        
        // Copy all properties
        newAnim.loop = anim.loop;
        newAnim.guard = anim.guard;
        newAnim.endState = anim.endState;
        
        // Deep copy all keyframes
        newAnim.keyframes = JSON.parse(JSON.stringify(anim.keyframes));
        
        updateAnimationList();
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete animation';
      deleteBtn.className = 'animation-btn delete-animation-btn';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete animation "${name}"?`)) {
          state.animSystem.removeAnimation(name);
          updateAnimationList();
        }
      });
      
      controls.appendChild(playBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(duplicateBtn);
      controls.appendChild(deleteBtn);
      
      headerRight.appendChild(controls);
      header.appendChild(headerLeft);
      header.appendChild(headerRight);
      
      // Edit form section
      const form = document.createElement('div');
      form.className = 'animation-form';
      
      // Region selection
      const regionRow = document.createElement('div');
      regionRow.className = 'form-row';
      
      const regionLabel = document.createElement('label');
      regionLabel.textContent = 'Region:';
      regionLabel.className = 'form-label';
      
      const regionSelect = document.createElement('select');
      regionSelect.className = 'form-select';
      
      const noRegionOption = document.createElement('option');
      noRegionOption.value = '';
      noRegionOption.textContent = '(none)';
      regionSelect.appendChild(noRegionOption);
      
      for (const [regionName, region] of state.animSystem.regions.entries()) {
        const option = document.createElement('option');
        option.value = regionName;
        option.textContent = regionName;
        option.selected = anim.regionName === regionName;
        regionSelect.appendChild(option);
      }
      
      regionSelect.addEventListener('change', (e) => {
        const newRegionName = e.target.value || null;
        anim.regionName = newRegionName;
        if (newRegionName && state.animSystem.regions.has(newRegionName)) {
          anim.region = state.animSystem.regions.get(newRegionName);
        } else {
          anim.region = null;
        }
      });
      
      regionRow.appendChild(regionLabel);
      regionRow.appendChild(regionSelect);
      
      // Loop checkbox
      const loopRow = document.createElement('div');
      loopRow.className = 'form-row';
      
      const loopCheckbox = document.createElement('input');
      loopCheckbox.type = 'checkbox';
      loopCheckbox.id = `anim-loop-${name}`;
      loopCheckbox.checked = anim.loop;
      loopCheckbox.addEventListener('change', (e) => {
        anim.loop = e.target.checked;
        updateAnimationList();
      });
      
      const loopLabel = document.createElement('label');
      loopLabel.htmlFor = `anim-loop-${name}`;
      loopLabel.textContent = 'Loop';
      loopLabel.className = 'form-checkbox-label';
      
      loopRow.appendChild(loopCheckbox);
      loopRow.appendChild(loopLabel);
      
      // Guard state
      const guardRow = document.createElement('div');
      guardRow.className = 'form-row';
      
      const guardLabel = document.createElement('label');
      guardLabel.textContent = 'Guard:';
      guardLabel.className = 'form-label';
      
      const guardInput = document.createElement('input');
      guardInput.type = 'text';
      guardInput.className = 'form-input';
      guardInput.placeholder = '(none)';
      guardInput.value = anim.guard || '';
      guardInput.addEventListener('change', (e) => {
        anim.guard = e.target.value || null;
      });
      
      guardRow.appendChild(guardLabel);
      guardRow.appendChild(guardInput);
      
      // End state
      const endStateRow = document.createElement('div');
      endStateRow.className = 'form-row';
      
      const endStateLabel = document.createElement('label');
      endStateLabel.textContent = 'End State:';
      endStateLabel.className = 'form-label';
      
      const endStateInput = document.createElement('input');
      endStateInput.type = 'text';
      endStateInput.className = 'form-input';
      endStateInput.placeholder = '(none)';
      endStateInput.value = anim.endState || '';
      endStateInput.addEventListener('change', (e) => {
        anim.endState = e.target.value || null;
      });
      
      endStateRow.appendChild(endStateLabel);
      endStateRow.appendChild(endStateInput);
      
      form.appendChild(regionRow);
      form.appendChild(loopRow);
      form.appendChild(guardRow);
      form.appendChild(endStateRow);
      
      // Keyframes section
      const keyframesSection = document.createElement('div');
      keyframesSection.className = 'keyframes-section';
      
      const keyframesHeader = document.createElement('div');
      keyframesHeader.className = 'keyframes-header';
      
      const keyframesTitle = document.createElement('h6');
      keyframesTitle.textContent = 'Keyframes';
      keyframesTitle.style.margin = '0';
      keyframesTitle.style.fontSize = '12px';
      keyframesTitle.style.color = '#888';
      keyframesTitle.style.fontWeight = '600';
      keyframesTitle.style.textTransform = 'uppercase';
      
      const addKeyframeBtn = document.createElement('button');
      addKeyframeBtn.textContent = '+ Add';
      addKeyframeBtn.className = 'add-keyframe-btn';
      addKeyframeBtn.addEventListener('click', () => {
        // Add a default wait keyframe
        anim.keyframes.push({
          type: 'wait',
          duration: 1
        });
        updateAnimationList();
      });
      
      keyframesHeader.appendChild(keyframesTitle);
      keyframesHeader.appendChild(addKeyframeBtn);
      keyframesSection.appendChild(keyframesHeader);
      
      // Render each keyframe
      const keyframesList = document.createElement('div');
      keyframesList.className = 'keyframes-list';
      
      anim.keyframes.forEach((kf, kfIdx) => {
        const kfItem = document.createElement('div');
        kfItem.className = 'keyframe-item';
        
        const kfHeader = document.createElement('div');
        kfHeader.className = 'keyframe-header';
        
        const kfTypeLabel = document.createElement('span');
        kfTypeLabel.className = 'keyframe-type-label';
        kfTypeLabel.textContent = `${kfIdx + 1}. ${kf.type.toUpperCase()}`;
        
        const kfButtons = document.createElement('div');
        kfButtons.className = 'keyframe-buttons';
        
        // Move up button (not for first keyframe)
        if (kfIdx > 0) {
          const kfMoveUpBtn = document.createElement('button');
          kfMoveUpBtn.textContent = '↑';
          kfMoveUpBtn.className = 'keyframe-move-btn';
          kfMoveUpBtn.title = 'Move keyframe up';
          kfMoveUpBtn.addEventListener('click', () => {
            // Swap with previous keyframe
            [anim.keyframes[kfIdx - 1], anim.keyframes[kfIdx]] = [anim.keyframes[kfIdx], anim.keyframes[kfIdx - 1]];
            updateAnimationList();
          });
          kfButtons.appendChild(kfMoveUpBtn);
        }
        
        // Move down button (not for last keyframe)
        if (kfIdx < anim.keyframes.length - 1) {
          const kfMoveDownBtn = document.createElement('button');
          kfMoveDownBtn.textContent = '↓';
          kfMoveDownBtn.className = 'keyframe-move-btn';
          kfMoveDownBtn.title = 'Move keyframe down';
          kfMoveDownBtn.addEventListener('click', () => {
            // Swap with next keyframe
            [anim.keyframes[kfIdx], anim.keyframes[kfIdx + 1]] = [anim.keyframes[kfIdx + 1], anim.keyframes[kfIdx]];
            updateAnimationList();
          });
          kfButtons.appendChild(kfMoveDownBtn);
        }
        
        const kfDuplicateBtn = document.createElement('button');
        kfDuplicateBtn.textContent = '⎘';
        kfDuplicateBtn.className = 'keyframe-duplicate-btn';
        kfDuplicateBtn.title = 'Duplicate keyframe';
        kfDuplicateBtn.addEventListener('click', () => {
          // Deep copy the keyframe
          const copy = JSON.parse(JSON.stringify(kf));
          // Insert after current keyframe
          anim.keyframes.splice(kfIdx + 1, 0, copy);
          updateAnimationList();
        });
        
        const kfDeleteBtn = document.createElement('button');
        kfDeleteBtn.textContent = '×';
        kfDeleteBtn.className = 'keyframe-delete-btn';
        kfDeleteBtn.title = 'Delete keyframe';
        kfDeleteBtn.addEventListener('click', () => {
          anim.keyframes.splice(kfIdx, 1);
          updateAnimationList();
        });
        
        kfButtons.appendChild(kfDuplicateBtn);
        kfButtons.appendChild(kfDeleteBtn);
        
        kfHeader.appendChild(kfTypeLabel);
        kfHeader.appendChild(kfButtons);
        
        const kfForm = document.createElement('div');
        kfForm.className = 'keyframe-form';
        
        // Type selector
        const typeRow = document.createElement('div');
        typeRow.className = 'form-row';
        
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Type:';
        typeLabel.className = 'form-label';
        
        const typeSelect = document.createElement('select');
        typeSelect.className = 'form-select';
        
        ['wait', 'rotate', 'move'].forEach(type => {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = type;
          option.selected = kf.type === type;
          typeSelect.appendChild(option);
        });
        
        typeSelect.addEventListener('change', (e) => {
          const oldType = kf.type;
          const newType = e.target.value;
          
          // Reset keyframe with new type
          if (newType === 'wait') {
            anim.keyframes[kfIdx] = { type: 'wait', duration: kf.duration || 1 };
          } else if (newType === 'rotate') {
            anim.keyframes[kfIdx] = {
              type: 'rotate',
              from: 0,
              to: 90,
              duration: kf.duration || 1,
              pivot: [0, 0, 0],
              axis: [0, 1, 0]
            };
          } else if (newType === 'move') {
            anim.keyframes[kfIdx] = {
              type: 'move',
              axis: 'y',
              delta: 1,
              duration: kf.duration || 1
            };
          }
          updateAnimationList();
        });
        
        typeRow.appendChild(typeLabel);
        typeRow.appendChild(typeSelect);
        kfForm.appendChild(typeRow);
        
        // Duration (common to all types)
        const durationRow = document.createElement('div');
        durationRow.className = 'form-row';
        
        const durationLabel = document.createElement('label');
        durationLabel.textContent = 'Duration:';
        durationLabel.className = 'form-label';
        
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.className = 'form-input';
        durationInput.min = '0';
        durationInput.step = '0.1';
        durationInput.value = kf.duration || 0;
        durationInput.addEventListener('change', (e) => {
          kf.duration = parseFloat(e.target.value) || 0;
        });
        
        durationRow.appendChild(durationLabel);
        durationRow.appendChild(durationInput);
        kfForm.appendChild(durationRow);
        
        // Type-specific fields
        if (kf.type === 'rotate') {
          // From angle
          const fromRow = document.createElement('div');
          fromRow.className = 'form-row';
          
          const fromLabel = document.createElement('label');
          fromLabel.textContent = 'From:';
          fromLabel.className = 'form-label';
          
          const fromInput = document.createElement('input');
          fromInput.type = 'number';
          fromInput.className = 'form-input';
          fromInput.step = '1';
          fromInput.value = kf.from || 0;
          fromInput.addEventListener('change', (e) => {
            kf.from = parseFloat(e.target.value) || 0;
          });
          
          fromRow.appendChild(fromLabel);
          fromRow.appendChild(fromInput);
          kfForm.appendChild(fromRow);
          
          // To angle
          const toRow = document.createElement('div');
          toRow.className = 'form-row';
          
          const toLabel = document.createElement('label');
          toLabel.textContent = 'To:';
          toLabel.className = 'form-label';
          
          const toInput = document.createElement('input');
          toInput.type = 'number';
          toInput.className = 'form-input';
          toInput.step = '1';
          toInput.value = kf.to || 0;
          toInput.addEventListener('change', (e) => {
            kf.to = parseFloat(e.target.value) || 0;
          });
          
          toRow.appendChild(toLabel);
          toRow.appendChild(toInput);
          kfForm.appendChild(toRow);
          
          // Pivot
          const pivotRow = document.createElement('div');
          pivotRow.className = 'form-row';
          
          const pivotLabel = document.createElement('label');
          pivotLabel.textContent = 'Pivot:';
          pivotLabel.className = 'form-label';
          
          const pivotInput = document.createElement('input');
          pivotInput.type = 'text';
          pivotInput.className = 'form-input';
          pivotInput.placeholder = '0, 0, 0';
          pivotInput.value = kf.pivot ? kf.pivot.join(', ') : '0, 0, 0';
          pivotInput.addEventListener('change', (e) => {
            const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
            kf.pivot = [values[0] || 0, values[1] || 0, values[2] || 0];
          });
          
          pivotRow.appendChild(pivotLabel);
          pivotRow.appendChild(pivotInput);
          kfForm.appendChild(pivotRow);
          
          // Axis
          const axisRow = document.createElement('div');
          axisRow.className = 'form-row';
          
          const axisLabel = document.createElement('label');
          axisLabel.textContent = 'Axis:';
          axisLabel.className = 'form-label';
          
          const axisInput = document.createElement('input');
          axisInput.type = 'text';
          axisInput.className = 'form-input';
          axisInput.placeholder = '0, 1, 0';
          axisInput.value = kf.axis ? kf.axis.join(', ') : '0, 1, 0';
          axisInput.addEventListener('change', (e) => {
            const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
            kf.axis = [values[0] || 0, values[1] || 0, values[2] || 0];
          });
          
          axisRow.appendChild(axisLabel);
          axisRow.appendChild(axisInput);
          kfForm.appendChild(axisRow);
          
        } else if (kf.type === 'move') {
          // Axis selection
          const axisRow = document.createElement('div');
          axisRow.className = 'form-row';
          
          const axisLabel = document.createElement('label');
          axisLabel.textContent = 'Axis:';
          axisLabel.className = 'form-label';
          
          const axisSelect = document.createElement('select');
          axisSelect.className = 'form-select';
          
          ['x', 'y', 'z'].forEach(axis => {
            const option = document.createElement('option');
            option.value = axis;
            option.textContent = axis.toUpperCase();
            option.selected = kf.axis === axis;
            axisSelect.appendChild(option);
          });
          
          axisSelect.addEventListener('change', (e) => {
            kf.axis = e.target.value;
          });
          
          axisRow.appendChild(axisLabel);
          axisRow.appendChild(axisSelect);
          kfForm.appendChild(axisRow);
          
          // Delta
          const deltaRow = document.createElement('div');
          deltaRow.className = 'form-row';
          
          const deltaLabel = document.createElement('label');
          deltaLabel.textContent = 'Delta:';
          deltaLabel.className = 'form-label';
          
          const deltaInput = document.createElement('input');
          deltaInput.type = 'number';
          deltaInput.className = 'form-input';
          deltaInput.step = '0.1';
          deltaInput.value = kf.delta || 0;
          deltaInput.addEventListener('change', (e) => {
            kf.delta = parseFloat(e.target.value) || 0;
          });
          
          deltaRow.appendChild(deltaLabel);
          deltaRow.appendChild(deltaInput);
          kfForm.appendChild(deltaRow);
        }
        
        // Easing (optional for rotate and move)
        if (kf.type === 'rotate' || kf.type === 'move') {
          const easingRow = document.createElement('div');
          easingRow.className = 'form-row';
          
          const easingLabel = document.createElement('label');
          easingLabel.textContent = 'Easing:';
          easingLabel.className = 'form-label';
          
          const easingSelect = document.createElement('select');
          easingSelect.className = 'form-select';
          
          const easingOptions = ['(none)', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'steps'];
          easingOptions.forEach(easing => {
            const option = document.createElement('option');
            option.value = easing === '(none)' ? '' : easing;
            option.textContent = easing;
            option.selected = (kf.easing || '') === (easing === '(none)' ? '' : easing);
            easingSelect.appendChild(option);
          });
          
          easingSelect.addEventListener('change', (e) => {
            if (e.target.value) {
              kf.easing = e.target.value;
            } else {
              delete kf.easing;
            }
            updateAnimationList();
          });
          
          easingRow.appendChild(easingLabel);
          easingRow.appendChild(easingSelect);
          kfForm.appendChild(easingRow);
          
          // Steps parameter (only for steps easing)
          if (kf.easing === 'steps') {
            const stepsRow = document.createElement('div');
            stepsRow.className = 'form-row';
            
            const stepsLabel = document.createElement('label');
            stepsLabel.textContent = 'Steps:';
            stepsLabel.className = 'form-label';
            
            const stepsInput = document.createElement('input');
            stepsInput.type = 'number';
            stepsInput.className = 'form-input';
            stepsInput.min = '1';
            stepsInput.step = '1';
            stepsInput.value = kf.steps || 10;
            stepsInput.addEventListener('change', (e) => {
              kf.steps = parseInt(e.target.value) || 10;
            });
            
            stepsRow.appendChild(stepsLabel);
            stepsRow.appendChild(stepsInput);
            kfForm.appendChild(stepsRow);
          }
        }
        
        kfItem.appendChild(kfHeader);
        kfItem.appendChild(kfForm);
        keyframesList.appendChild(kfItem);
      });
      
      keyframesSection.appendChild(keyframesList);
      form.appendChild(keyframesSection);
      
      item.appendChild(header);
      item.appendChild(form);
      container.appendChild(item);
    }
    
    // Emitters and sequences are now in separate sections
  }

  // Update the emitter list UI
  function updateEmitterList() {
    const container = document.getElementById('emitterList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Add "Add Emitter" button at the top
    const addEmitterBtn = document.createElement('button');
    addEmitterBtn.textContent = '+ Add Emitter';
    addEmitterBtn.className = 'add-animation-btn';
    addEmitterBtn.addEventListener('click', () => {
      const newName = state.animSystem.generateUniqueEmitterName('emitter');
      const emitter = state.animSystem.addEmitter(newName);
      updateEmitterList();
    });
    container.appendChild(addEmitterBtn);
    
    if (state.animSystem.emitters.size === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontSize = '12px';
      emptyMsg.style.margin = '8px 0';
      emptyMsg.textContent = 'No emitters defined';
      container.appendChild(emptyMsg);
      return;
    }
    
    const emitterHeader = document.createElement('h5');
    emitterHeader.textContent = 'Emitters';
    emitterHeader.style.margin = '8px 0 4px 0';
    container.appendChild(emitterHeader);
    
    for (const [name, emitter] of state.animSystem.emitters.entries()) {
      const item = document.createElement('div');
      item.className = 'animation-item expanded';
      
      // Header section
      const header = document.createElement('div');
      header.className = 'animation-header';
      
      const headerLeft = document.createElement('div');
      headerLeft.className = 'animation-header-left';
      
      const nameLabel = document.createElement('span');
      nameLabel.className = 'animation-name';
      nameLabel.textContent = name;
      headerLeft.appendChild(nameLabel);
      
      const particleCount = document.createElement('span');
      particleCount.className = 'animation-badge';
      particleCount.textContent = `${emitter.particles.length} particles`;
      headerLeft.appendChild(particleCount);
      
      if (emitter.enabled) {
        const statusBadge = document.createElement('span');
        statusBadge.className = 'animation-badge';
        statusBadge.textContent = 'active';
        statusBadge.style.background = 'rgba(100, 200, 100, 0.3)';
        headerLeft.appendChild(statusBadge);
      }
      
      const headerRight = document.createElement('div');
      headerRight.className = 'animation-header-right';
      
      const controls = document.createElement('div');
      controls.className = 'animation-controls-inline';
      
      const startBtn = document.createElement('button');
      startBtn.textContent = '▶';
      startBtn.title = 'Start';
      startBtn.className = 'animation-btn';
      startBtn.addEventListener('click', () => {
        state.animSystem.startEmitter(name);
        updateEmitterList();
      });
      
      const stopBtn = document.createElement('button');
      stopBtn.textContent = '⏹';
      stopBtn.title = 'Stop';
      stopBtn.className = 'animation-btn';
      stopBtn.addEventListener('click', () => {
        state.animSystem.stopEmitter(name);
        updateEmitterList();
      });
      
      const clearBtn = document.createElement('button');
      clearBtn.textContent = '↺';
      clearBtn.title = 'Clear particles';
      clearBtn.className = 'animation-btn';
      clearBtn.addEventListener('click', () => {
        state.animSystem.clearEmitter(name);
      });
      
      const duplicateBtn = document.createElement('button');
      duplicateBtn.textContent = '⎘';
      duplicateBtn.title = 'Duplicate emitter';
      duplicateBtn.className = 'animation-btn keyframe-duplicate-btn';
      duplicateBtn.addEventListener('click', () => {
        const newName = state.animSystem.generateUniqueEmitterName(name);
        const newEmitter = state.animSystem.addEmitter(newName);
        
        // Copy all properties from the original emitter
        newEmitter.position = [...emitter.position];
        newEmitter.rate = emitter.rate;
        newEmitter.particleLifetime = emitter.particleLifetime;
        newEmitter.particleSize = emitter.particleSize;
        newEmitter.velocityBase = [...emitter.velocityBase];
        newEmitter.velocitySpread = [...emitter.velocitySpread];
        newEmitter.colorIds = [...emitter.colorIds];
        newEmitter.gravity = [...emitter.gravity];
        newEmitter.maxParticles = emitter.maxParticles;
        
        updateEmitterList();
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete emitter';
      deleteBtn.className = 'animation-btn delete-animation-btn';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete emitter "${name}"?`)) {
          state.animSystem.removeEmitter(name);
          updateEmitterList();
        }
      });
      
      controls.appendChild(startBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(clearBtn);
      controls.appendChild(duplicateBtn);
      controls.appendChild(deleteBtn);
      
      headerRight.appendChild(controls);
      header.appendChild(headerLeft);
      header.appendChild(headerRight);
      
      // Edit form section
      const form = document.createElement('div');
      form.className = 'animation-form';
      
      // Position
      const posRow = document.createElement('div');
      posRow.className = 'form-row';
      
      const posLabel = document.createElement('label');
      posLabel.textContent = 'Position:';
      posLabel.className = 'form-label';
      
      const posInput = document.createElement('input');
      posInput.type = 'text';
      posInput.className = 'form-input';
      posInput.placeholder = '0, 0, 0';
      posInput.value = emitter.position.join(', ');
      posInput.addEventListener('change', (e) => {
        const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
        emitter.position = [values[0] || 0, values[1] || 0, values[2] || 0];
      });
      
      posRow.appendChild(posLabel);
      posRow.appendChild(posInput);
      form.appendChild(posRow);
      
      // Rate
      const rateRow = document.createElement('div');
      rateRow.className = 'form-row';
      
      const rateLabel = document.createElement('label');
      rateLabel.textContent = 'Rate:';
      rateLabel.className = 'form-label';
      
      const rateInput = document.createElement('input');
      rateInput.type = 'number';
      rateInput.className = 'form-input';
      rateInput.min = '0';
      rateInput.step = '1';
      rateInput.value = emitter.rate;
      rateInput.title = 'Particles per second';
      rateInput.addEventListener('change', (e) => {
        emitter.rate = parseFloat(e.target.value) || 10;
      });
      
      rateRow.appendChild(rateLabel);
      rateRow.appendChild(rateInput);
      form.appendChild(rateRow);
      
      // Particle Lifetime
      const lifetimeRow = document.createElement('div');
      lifetimeRow.className = 'form-row';
      
      const lifetimeLabel = document.createElement('label');
      lifetimeLabel.textContent = 'Lifetime:';
      lifetimeLabel.className = 'form-label';
      
      const lifetimeInput = document.createElement('input');
      lifetimeInput.type = 'number';
      lifetimeInput.className = 'form-input';
      lifetimeInput.min = '0';
      lifetimeInput.step = '0.1';
      lifetimeInput.value = emitter.particleLifetime;
      lifetimeInput.title = 'How long each particle lives (seconds)';
      lifetimeInput.addEventListener('change', (e) => {
        emitter.particleLifetime = parseFloat(e.target.value) || 2.0;
      });
      
      lifetimeRow.appendChild(lifetimeLabel);
      lifetimeRow.appendChild(lifetimeInput);
      form.appendChild(lifetimeRow);
      
      // Particle Size
      const sizeRow = document.createElement('div');
      sizeRow.className = 'form-row';
      
      const sizeLabel = document.createElement('label');
      sizeLabel.textContent = 'Size:';
      sizeLabel.className = 'form-label';
      
      const sizeInput = document.createElement('input');
      sizeInput.type = 'number';
      sizeInput.className = 'form-input';
      sizeInput.min = '0';
      sizeInput.step = '0.1';
      sizeInput.value = emitter.particleSize;
      sizeInput.title = 'Size of each particle cube';
      sizeInput.addEventListener('change', (e) => {
        emitter.particleSize = parseFloat(e.target.value) || 0.2;
      });
      
      sizeRow.appendChild(sizeLabel);
      sizeRow.appendChild(sizeInput);
      form.appendChild(sizeRow);
      
      // Velocity Base
      const velBaseRow = document.createElement('div');
      velBaseRow.className = 'form-row';
      
      const velBaseLabel = document.createElement('label');
      velBaseLabel.textContent = 'Velocity:';
      velBaseLabel.className = 'form-label';
      
      const velBaseInput = document.createElement('input');
      velBaseInput.type = 'text';
      velBaseInput.className = 'form-input';
      velBaseInput.placeholder = '0, 5, 0';
      velBaseInput.value = emitter.velocityBase.join(', ');
      velBaseInput.title = 'Base velocity vector';
      velBaseInput.addEventListener('change', (e) => {
        const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
        emitter.velocityBase = [values[0] || 0, values[1] || 0, values[2] || 0];
      });
      
      velBaseRow.appendChild(velBaseLabel);
      velBaseRow.appendChild(velBaseInput);
      form.appendChild(velBaseRow);
      
      // Velocity Spread
      const velSpreadRow = document.createElement('div');
      velSpreadRow.className = 'form-row';
      
      const velSpreadLabel = document.createElement('label');
      velSpreadLabel.textContent = 'Spread:';
      velSpreadLabel.className = 'form-label';
      
      const velSpreadInput = document.createElement('input');
      velSpreadInput.type = 'text';
      velSpreadInput.className = 'form-input';
      velSpreadInput.placeholder = '1, 1, 1';
      velSpreadInput.value = emitter.velocitySpread.join(', ');
      velSpreadInput.title = 'Random velocity spread amount';
      velSpreadInput.addEventListener('change', (e) => {
        const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
        emitter.velocitySpread = [values[0] || 0, values[1] || 0, values[2] || 0];
      });
      
      velSpreadRow.appendChild(velSpreadLabel);
      velSpreadRow.appendChild(velSpreadInput);
      form.appendChild(velSpreadRow);
      
      // Color IDs
      const colorRow = document.createElement('div');
      colorRow.className = 'form-row';
      
      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Colors:';
      colorLabel.className = 'form-label';
      
      const colorInput = document.createElement('input');
      colorInput.type = 'text';
      colorInput.className = 'form-input';
      colorInput.placeholder = '0, 1, 2';
      colorInput.value = emitter.colorIds.join(', ');
      colorInput.title = 'Material IDs to randomly use (0-15)';
      colorInput.addEventListener('change', (e) => {
        const values = e.target.value.split(',').map(s => Math.floor(parseFloat(s.trim())) || 0);
        emitter.colorIds = values.filter(v => v >= 0 && v <= 15);
        if (emitter.colorIds.length === 0) emitter.colorIds = [0];
      });
      
      colorRow.appendChild(colorLabel);
      colorRow.appendChild(colorInput);
      form.appendChild(colorRow);
      
      // Gravity
      const gravityRow = document.createElement('div');
      gravityRow.className = 'form-row';
      
      const gravityLabel = document.createElement('label');
      gravityLabel.textContent = 'Gravity:';
      gravityLabel.className = 'form-label';
      
      const gravityInput = document.createElement('input');
      gravityInput.type = 'text';
      gravityInput.className = 'form-input';
      gravityInput.placeholder = '0, -9.8, 0';
      gravityInput.value = emitter.gravity.join(', ');
      gravityInput.title = 'Gravity acceleration vector';
      gravityInput.addEventListener('change', (e) => {
        const values = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
        emitter.gravity = [values[0] || 0, values[1] || 0, values[2] || 0];
      });
      
      gravityRow.appendChild(gravityLabel);
      gravityRow.appendChild(gravityInput);
      form.appendChild(gravityRow);
      
      // Max Particles
      const maxRow = document.createElement('div');
      maxRow.className = 'form-row';
      
      const maxLabel = document.createElement('label');
      maxLabel.textContent = 'Max Particles:';
      maxLabel.className = 'form-label';
      
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.className = 'form-input';
      maxInput.min = '1';
      maxInput.step = '1';
      maxInput.value = emitter.maxParticles;
      maxInput.title = 'Maximum number of particles (safety limit)';
      maxInput.addEventListener('change', (e) => {
        emitter.maxParticles = parseInt(e.target.value) || 1000;
      });
      
      maxRow.appendChild(maxLabel);
      maxRow.appendChild(maxInput);
      form.appendChild(maxRow);
      
      item.appendChild(header);
      item.appendChild(form);
      container.appendChild(item);
    }
  }

  // Update the sequence list UI
  function updateSequenceList() {
    const container = document.getElementById('sequenceList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Add "Add Sequence" button at the top
    const addSequenceBtn = document.createElement('button');
    addSequenceBtn.textContent = '+ Add Sequence';
    addSequenceBtn.className = 'add-animation-btn';
    addSequenceBtn.addEventListener('click', () => {
      const newName = state.animSystem.generateUniqueSequenceName('sequence');
      state.animSystem.addSequence(newName);
      updateSequenceList();
    });
    container.appendChild(addSequenceBtn);
    
    if (state.animSystem.sequences.size === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontSize = '12px';
      emptyMsg.style.margin = '8px 0';
      emptyMsg.textContent = 'No sequences defined';
      container.appendChild(emptyMsg);
      return;
    }
    
    const sequenceHeader = document.createElement('h5');
    sequenceHeader.textContent = 'Sequences';
    sequenceHeader.style.margin = '8px 0 4px 0';
    container.appendChild(sequenceHeader);
    
    for (const [name, sequence] of state.animSystem.sequences.entries()) {
      const item = document.createElement('div');
      item.className = 'animation-item expanded';
      
      // Header section
      const header = document.createElement('div');
      header.className = 'animation-header';
      
      const headerLeft = document.createElement('div');
      headerLeft.className = 'animation-header-left';
      
      const nameLabel = document.createElement('span');
      nameLabel.className = 'animation-name';
      nameLabel.textContent = name;
      headerLeft.appendChild(nameLabel);
      
      const countBadge = document.createElement('span');
      countBadge.className = 'animation-badge';
      const totalCount = sequence.animationNames.length + sequence.emitterNames.length;
      countBadge.textContent = `${totalCount} items`;
      headerLeft.appendChild(countBadge);
      
      const headerRight = document.createElement('div');
      headerRight.className = 'animation-header-right';
      
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
      
      const duplicateBtn = document.createElement('button');
      duplicateBtn.textContent = '⎘';
      duplicateBtn.title = 'Duplicate sequence';
      duplicateBtn.className = 'animation-btn keyframe-duplicate-btn';
      duplicateBtn.addEventListener('click', () => {
        const newName = state.animSystem.generateUniqueSequenceName(name);
        const newSequence = state.animSystem.addSequence(newName);
        
        // Copy all animation and emitter names
        newSequence.animationNames = [...sequence.animationNames];
        newSequence.emitterNames = [...sequence.emitterNames];
        
        updateSequenceList();
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete sequence';
      deleteBtn.className = 'animation-btn delete-animation-btn';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete sequence "${name}"?`)) {
          state.animSystem.removeSequence(name);
          updateSequenceList();
        }
      });
      
      controls.appendChild(playBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(duplicateBtn);
      controls.appendChild(deleteBtn);
      
      headerRight.appendChild(controls);
      header.appendChild(headerLeft);
      header.appendChild(headerRight);
      
      // Edit form section
      const form = document.createElement('div');
      form.className = 'animation-form';
      
      // Animations section
      const animSection = document.createElement('div');
      animSection.className = 'sequence-section';
      
      const animSectionHeader = document.createElement('div');
      animSectionHeader.className = 'sequence-section-header';
      
      const animTitle = document.createElement('h6');
      animTitle.textContent = 'Animations';
      animTitle.style.margin = '0';
      animTitle.style.fontSize = '12px';
      animTitle.style.color = '#888';
      animTitle.style.fontWeight = '600';
      animTitle.style.textTransform = 'uppercase';
      
      const addAnimToSeqBtn = document.createElement('button');
      addAnimToSeqBtn.textContent = '+';
      addAnimToSeqBtn.className = 'sequence-add-btn';
      addAnimToSeqBtn.title = 'Add animation to sequence';
      addAnimToSeqBtn.addEventListener('click', () => {
        // Create a dropdown with available animations
        const availableAnims = Array.from(state.animSystem.animations.keys())
          .filter(aName => !sequence.animationNames.includes(aName));
        
        if (availableAnims.length === 0) {
          alert('No animations available to add');
          return;
        }
        
        // Add first available animation (could be enhanced with a modal selector)
        sequence.addAnimation(availableAnims[0]);
        updateSequenceList();
      });
      
      animSectionHeader.appendChild(animTitle);
      animSectionHeader.appendChild(addAnimToSeqBtn);
      animSection.appendChild(animSectionHeader);
      
      const animList = document.createElement('div');
      animList.className = 'sequence-item-list';
      
      if (sequence.animationNames.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.color = '#666';
        emptyMsg.style.fontSize = '11px';
        emptyMsg.style.margin = '4px 0';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.textContent = 'No animations';
        animList.appendChild(emptyMsg);
      } else {
        sequence.animationNames.forEach((animName, idx) => {
          const animItem = document.createElement('div');
          animItem.className = 'sequence-item';
          
          const animNameSpan = document.createElement('span');
          animNameSpan.textContent = animName;
          animNameSpan.style.fontSize = '12px';
          animNameSpan.style.color = '#cfd3dc';
          
          const animItemBtns = document.createElement('div');
          animItemBtns.className = 'sequence-item-buttons';
          
          // Move up button
          if (idx > 0) {
            const moveUpBtn = document.createElement('button');
            moveUpBtn.textContent = '↑';
            moveUpBtn.className = 'keyframe-move-btn';
            moveUpBtn.title = 'Move up';
            moveUpBtn.addEventListener('click', () => {
              [sequence.animationNames[idx - 1], sequence.animationNames[idx]] = 
                [sequence.animationNames[idx], sequence.animationNames[idx - 1]];
              updateSequenceList();
            });
            animItemBtns.appendChild(moveUpBtn);
          }
          
          // Move down button
          if (idx < sequence.animationNames.length - 1) {
            const moveDownBtn = document.createElement('button');
            moveDownBtn.textContent = '↓';
            moveDownBtn.className = 'keyframe-move-btn';
            moveDownBtn.title = 'Move down';
            moveDownBtn.addEventListener('click', () => {
              [sequence.animationNames[idx], sequence.animationNames[idx + 1]] = 
                [sequence.animationNames[idx + 1], sequence.animationNames[idx]];
              updateSequenceList();
            });
            animItemBtns.appendChild(moveDownBtn);
          }
          
          const removeBtn = document.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.className = 'sequence-remove-btn';
          removeBtn.title = 'Remove from sequence';
          removeBtn.addEventListener('click', () => {
            sequence.animationNames.splice(idx, 1);
            updateSequenceList();
          });
          animItemBtns.appendChild(removeBtn);
          
          animItem.appendChild(animNameSpan);
          animItem.appendChild(animItemBtns);
          animList.appendChild(animItem);
        });
      }
      
      animSection.appendChild(animList);
      form.appendChild(animSection);
      
      // Emitters section
      const emitterSection = document.createElement('div');
      emitterSection.className = 'sequence-section';
      
      const emitterSectionHeader = document.createElement('div');
      emitterSectionHeader.className = 'sequence-section-header';
      
      const emitterTitle = document.createElement('h6');
      emitterTitle.textContent = 'Emitters';
      emitterTitle.style.margin = '0';
      emitterTitle.style.fontSize = '12px';
      emitterTitle.style.color = '#888';
      emitterTitle.style.fontWeight = '600';
      emitterTitle.style.textTransform = 'uppercase';
      
      const addEmitterToSeqBtn = document.createElement('button');
      addEmitterToSeqBtn.textContent = '+';
      addEmitterToSeqBtn.className = 'sequence-add-btn';
      addEmitterToSeqBtn.title = 'Add emitter to sequence';
      addEmitterToSeqBtn.addEventListener('click', () => {
        // Create a dropdown with available emitters
        const availableEmitters = Array.from(state.animSystem.emitters.keys())
          .filter(eName => !sequence.emitterNames.includes(eName));
        
        if (availableEmitters.length === 0) {
          alert('No emitters available to add');
          return;
        }
        
        // Add first available emitter (could be enhanced with a modal selector)
        sequence.addEmitter(availableEmitters[0]);
        updateSequenceList();
      });
      
      emitterSectionHeader.appendChild(emitterTitle);
      emitterSectionHeader.appendChild(addEmitterToSeqBtn);
      emitterSection.appendChild(emitterSectionHeader);
      
      const emitterList = document.createElement('div');
      emitterList.className = 'sequence-item-list';
      
      if (sequence.emitterNames.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.color = '#666';
        emptyMsg.style.fontSize = '11px';
        emptyMsg.style.margin = '4px 0';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.textContent = 'No emitters';
        emitterList.appendChild(emptyMsg);
      } else {
        sequence.emitterNames.forEach((emitterName, idx) => {
          const emitterItem = document.createElement('div');
          emitterItem.className = 'sequence-item';
          
          const emitterNameSpan = document.createElement('span');
          emitterNameSpan.textContent = emitterName;
          emitterNameSpan.style.fontSize = '12px';
          emitterNameSpan.style.color = '#cfd3dc';
          
          const emitterItemBtns = document.createElement('div');
          emitterItemBtns.className = 'sequence-item-buttons';
          
          // Move up button
          if (idx > 0) {
            const moveUpBtn = document.createElement('button');
            moveUpBtn.textContent = '↑';
            moveUpBtn.className = 'keyframe-move-btn';
            moveUpBtn.title = 'Move up';
            moveUpBtn.addEventListener('click', () => {
              [sequence.emitterNames[idx - 1], sequence.emitterNames[idx]] = 
                [sequence.emitterNames[idx], sequence.emitterNames[idx - 1]];
              updateSequenceList();
            });
            emitterItemBtns.appendChild(moveUpBtn);
          }
          
          // Move down button
          if (idx < sequence.emitterNames.length - 1) {
            const moveDownBtn = document.createElement('button');
            moveDownBtn.textContent = '↓';
            moveDownBtn.className = 'keyframe-move-btn';
            moveDownBtn.title = 'Move down';
            moveDownBtn.addEventListener('click', () => {
              [sequence.emitterNames[idx], sequence.emitterNames[idx + 1]] = 
                [sequence.emitterNames[idx + 1], sequence.emitterNames[idx]];
              updateSequenceList();
            });
            emitterItemBtns.appendChild(moveDownBtn);
          }
          
          const removeBtn = document.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.className = 'sequence-remove-btn';
          removeBtn.title = 'Remove from sequence';
          removeBtn.addEventListener('click', () => {
            sequence.emitterNames.splice(idx, 1);
            updateSequenceList();
          });
          emitterItemBtns.appendChild(removeBtn);
          
          emitterItem.appendChild(emitterNameSpan);
          emitterItem.appendChild(emitterItemBtns);
          emitterList.appendChild(emitterItem);
        });
      }
      
      emitterSection.appendChild(emitterList);
      form.appendChild(emitterSection);
      
      item.appendChild(header);
      item.appendChild(form);
      container.appendChild(item);
    }
  }

  // Update the region list UI
  function updateRegionPanel() {
    const container = document.getElementById('regionList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.animSystem.regions.size === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontSize = '12px';
      emptyMsg.style.margin = '8px 0';
      emptyMsg.textContent = 'No regions defined';
      container.appendChild(emptyMsg);
      return;
    }
    
    if (state.animSystem.regions.size > 0) {
      const animHeader = document.createElement('h5');
      animHeader.textContent = 'Regions';
      animHeader.style.margin = '8px 0 4px 0';
      container.appendChild(animHeader);
    }

    const regionOverlays = state.getRegionOverlaysVisible();
    const selectedRegion = state.getSelectedRegionName();
    
    for (const [name, region] of state.animSystem.regions.entries()) {
      const item = document.createElement('div');
      item.className = 'region-item';
      if (selectedRegion === name) {
        item.classList.add('selected');
      }
      
      // Header with name and toggle
      const header = document.createElement('div');
      header.className = 'region-header';
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'region-name-input';
      nameInput.value = name;
      nameInput.addEventListener('change', (e) => {
        const newName = e.target.value.trim();
        if (!newName) {
          alert('Region name cannot be empty');
          e.target.value = name;
          return;
        }
        
        if (newName !== name) {
          try {
            // Store old overlay visibility state
            const wasVisible = regionOverlays.get(name) || false;
            
            // Rename the region
            state.animSystem.renameRegion(name, newName);
            
            // Update overlay visibility with new name
            regionOverlays.delete(name);
            if (wasVisible) {
              regionOverlays.set(newName, wasVisible);
            }
            
            // Update selected region if this was selected
            if (selectedRegion === name) {
              state.setSelectedRegionName(newName);
            }
            
            // Update chunk regions and rebuild meshes
            state.chunk.clearRegions();
            state.animSystem.regions.forEach((g, n) => {
              state.chunk.addRegion(n, g.min, g.max);
            });
            state.animSystem.assignVoxelsToRegions(state.chunk);
            state.buildAllMeshes();
            
            // Refresh UI
            updateRegionPanel();
            updateAnimationList();
          } catch (err) {
            alert(err.message);
            e.target.value = name;
          }
        }
      });
      
      const headerControls = document.createElement('div');
      headerControls.className = 'region-header-controls';
      
      const toggle = document.createElement('div');
      toggle.className = 'region-toggle';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `region-vis-${name}`;
      checkbox.checked = regionOverlays.get(name) || false;
      checkbox.addEventListener('change', (e) => {
        regionOverlays.set(name, e.target.checked);
        if (e.target.checked) {
          state.setSelectedRegionName(name);
          updateRegionPanel();
        }
      });
      
      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = `region-vis-${name}`;
      checkboxLabel.textContent = 'Show';
      
      toggle.appendChild(checkbox);
      toggle.appendChild(checkboxLabel);
      
      const duplicateBtn = document.createElement('button');
      duplicateBtn.textContent = '⎘';
      duplicateBtn.className = 'duplicate-region-btn';
      duplicateBtn.title = 'Duplicate region';
      duplicateBtn.addEventListener('click', () => {
        const newName = state.animSystem.generateUniqueRegionName(name);
        state.animSystem.addRegion(newName, [...region.min], [...region.max]);
        
        // Update chunk regions and rebuild meshes
        state.chunk.clearRegions();
        state.animSystem.regions.forEach((g, n) => {
          state.chunk.addRegion(n, g.min, g.max);
        });
        state.animSystem.assignVoxelsToRegions(state.chunk);
        state.buildAllMeshes();
        
        updateRegionPanel();
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.className = 'delete-region-btn';
      deleteBtn.title = 'Delete region';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete region "${name}"? This will also remove any animations using this region.`)) {
          state.animSystem.removeRegion(name);
          
          // Clear overlay visibility for this region
          regionOverlays.delete(name);
          if (selectedRegion === name) {
            state.setSelectedRegionName(null);
          }
          
          // Update chunk regions and rebuild meshes
          state.chunk.clearRegions();
          state.animSystem.regions.forEach((g, n) => {
            state.chunk.addRegion(n, g.min, g.max);
          });
          state.animSystem.assignVoxelsToRegions(state.chunk);
          state.buildAllMeshes();
          
          updateRegionPanel();
          updateAnimationList();
        }
      });
      
      headerControls.appendChild(toggle);
      headerControls.appendChild(duplicateBtn);
      headerControls.appendChild(deleteBtn);
      
      header.appendChild(nameInput);
      header.appendChild(headerControls);
      
      // Bounds inputs with +/- controls
      const boundsContainer = document.createElement('div');
      boundsContainer.className = 'region-bounds';
      
      // Helper function to update region and rebuild
      const updateRegionBounds = () => {
        state.chunk.clearRegions();
        state.animSystem.regions.forEach((g, n) => {
          state.chunk.addRegion(n, g.min, g.max);
        });
        state.animSystem.assignVoxelsToRegions(state.chunk);
        state.buildAllMeshes();
      };
      
      // Create min/max controls for each axis on the same row
      ['x', 'y', 'z'].forEach((axis, idx) => {
        const axisRow = document.createElement('div');
        axisRow.className = 'bounds-axis-row';
        
        // Min control
        const minRegion = document.createElement('div');
        minRegion.className = 'shift-button-region';
        
        const minMinusBtn = document.createElement('button');
        minMinusBtn.className = 'shift-btn shift-minus';
        minMinusBtn.textContent = '−';
        minMinusBtn.title = `Decrease min ${axis.toUpperCase()}`;
        minMinusBtn.addEventListener('click', () => {
          if (region.min[idx] > 0) {
            region.min[idx]--;
            updateRegionBounds();
            updateRegionPanel();
          }
        });
        
        const minLabel = document.createElement('span');
        minLabel.className = `shift-label shift-${axis}`;
        minLabel.textContent = axis.toUpperCase();
        
        const minValueSpan = document.createElement('span');
        minValueSpan.className = 'shift-value';
        minValueSpan.textContent = region.min[idx];
        minLabel.appendChild(minValueSpan);
        
        const minPlusBtn = document.createElement('button');
        minPlusBtn.className = 'shift-btn shift-plus';
        minPlusBtn.textContent = '+';
        minPlusBtn.title = `Increase min ${axis.toUpperCase()}`;
        minPlusBtn.addEventListener('click', () => {
          if (region.min[idx] < 255) {
            region.min[idx]++;
            updateRegionBounds();
            updateRegionPanel();
          }
        });
        
        minRegion.appendChild(minMinusBtn);
        minRegion.appendChild(minLabel);
        minRegion.appendChild(minPlusBtn);
        
        // Separator
        const separator = document.createElement('span');
        separator.className = 'bounds-separator';
        separator.textContent = '—';
        
        // Max control
        const maxRegion = document.createElement('div');
        maxRegion.className = 'shift-button-group';
        
        const maxMinusBtn = document.createElement('button');
        maxMinusBtn.className = 'shift-btn shift-minus';
        maxMinusBtn.textContent = '−';
        maxMinusBtn.title = `Decrease max ${axis.toUpperCase()}`;
        maxMinusBtn.addEventListener('click', () => {
          if (region.max[idx] > 0) {
            region.max[idx]--;
            updateRegionBounds();
            updateRegionPanel();
          }
        });
        
        const maxLabel = document.createElement('span');
        maxLabel.className = `shift-label shift-${axis}`;
        maxLabel.textContent = axis.toUpperCase();
        
        const maxValueSpan = document.createElement('span');
        maxValueSpan.className = 'shift-value';
        maxValueSpan.textContent = region.max[idx];
        maxLabel.appendChild(maxValueSpan);
        
        const maxPlusBtn = document.createElement('button');
        maxPlusBtn.className = 'shift-btn shift-plus';
        maxPlusBtn.textContent = '+';
        maxPlusBtn.title = `Increase max ${axis.toUpperCase()}`;
        maxPlusBtn.addEventListener('click', () => {
          if (region.max[idx] < 255) {
            region.max[idx]++;
            updateRegionBounds();
            updateRegionPanel();
          }
        });
        
        maxRegion.appendChild(maxMinusBtn);
        maxRegion.appendChild(maxLabel);
        maxRegion.appendChild(maxPlusBtn);
        
        axisRow.appendChild(minRegion);
        axisRow.appendChild(separator);
        axisRow.appendChild(maxRegion);
        boundsContainer.appendChild(axisRow);
      });
      
      item.appendChild(header);
      item.appendChild(boundsContainer);
      container.appendChild(item);
    }

    // Add "Add Region" button at the top
    const addRegionBtn = document.createElement('button');
    addRegionBtn.textContent = '+ Add Region';
    addRegionBtn.className = 'add-region-btn';
    addRegionBtn.addEventListener('click', () => {
      const newName = state.animSystem.generateUniqueRegionName('region');
      state.animSystem.addRegion(newName, [0, 0, 0], [1, 1, 1]);
      
      // Update chunk regions and rebuild meshes
      state.chunk.clearRegions();
      state.animSystem.regions.forEach((g, n) => {
        state.chunk.addRegion(n, g.min, g.max);
      });
      state.animSystem.assignVoxelsToRegions(state.chunk);
      state.buildAllMeshes();
      
      updateRegionPanel();
      updateAnimationList();
    });
    container.appendChild(addRegionBtn);

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
