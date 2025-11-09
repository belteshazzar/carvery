# Carvery - Voxel Editor Instructions

## Project Overview
Carvery is a **WebGL2-based voxel editor** with animation capabilities. It's a single-page application built with vanilla JavaScript and Vite, featuring a custom DSL for defining animated voxel groups.

**Core architecture**: Standalone modules with explicit state passing (no frameworks).

## Tech Stack
- **Build**: Vite with `vite-plugin-glsl` for shader imports
- **Graphics**: WebGL2 with custom GLSL shaders (no libraries)
- **State**: Mutable state passed through explicit object references
- **Module system**: ES6 modules

## Development Workflow

### Commands
```bash
npm run dev      # Start dev server (default: http://localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

### Shader Development
Shaders are imported as strings via `vite-plugin-glsl`. Example:
```javascript
import lambertVert from './lambert.vert';
import lambertFrag from './lambert.frag';
```
**GLSL files live in `src/`**, not a separate shaders directory.

## Architecture Patterns

### 1. State Management via Object References
The app uses **explicit state passing** through a `uiState` object created in `main.js`:
```javascript
const uiState = {
  chunk, palette, camera, animSystem,
  getMode: () => mode,
  setMode: (val) => { mode = val; },
  // ... many getters/setters
  buildAllMeshes, undo, redo
};
initializeUI(uiState);  // Pass state to UI module
```
**Pattern**: When adding UI handlers, extend `uiState` with needed references/functions.

### 2. Voxel Data Structure (VoxelChunk)
- **Fixed 16×16×16 grid** stored in flat arrays
- Dual representation: `_isSolid` (boolean array) + `_material` (Uint8Array, 0-15 palette indices)
- **Groups**: Optional named AABB masks for animations (`_groups` Map)
- **Coordinate system**: `idx3(x,y,z) = x + 16*(y + 16*z)` (X-major order)

```javascript
// Typical voxel operations
const id = chunk.idx3(x, y, z);
if (chunk.isSolid(id)) {
  const mat = chunk.material(id);  // 0-15
}
```

### 3. WebGL Program Wrapper (`webgl.js`)
`createProgram(gl, vertSrc, fragSrc)` introspects attributes/uniforms and returns:
```javascript
{
  program: WebGLProgram,
  vao: WebGLVertexArrayObject,
  aPosition: { kind: 'attribute', location, type, set },
  uModel: { kind: 'uniform', location, type, set: (mat4) => {...} },
  meta: {}  // Custom metadata (mesh counts, etc.)
}
```
**Convention**: Use the `.set()` helper for uniforms, never raw `gl.uniformXxx`.

### 4. Greedy Meshing
`VoxelChunk.buildGreedyRenderMeshMain/Group()` generates optimized geometry:
- Per-axis sweep merging coplanar quads
- **Two meshes**: Main (non-grouped voxels) + per-group VAOs
- Stores material ID per-vertex for palette lookup in shaders
- Outputs to `renderProg.meta.renderIndexCount` and `renderProg.meta.groups[name].indexCount`

**Critical**: Rebuild all meshes after group changes via `buildAllMeshes()`.

### 5. Mouse Picking System
- **Offscreen render** to `pickFBO` with voxel ID + face encoded in RGB
- Two separate VAOs: `pickProg.vao` (voxels) + `pickProg.vaoGround` (ground plane for add mode)
- Encoding: `pack = ((voxelId + 1) << 4) | (faceId & 7)` → RGB via bit shifts
- Face IDs: `0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z, 6=ground`

### 6. Animation System (DSL-based)
**Three-layer structure**:
```
AnimationSystem
├── groups: Map<name, AnimationGroup>  // AABB bounds + state machine
└── animations: Map<name, Animation>    // Keyframes + guard conditions
```

**DSL Example** (in `index.html` textarea):
```
group door {
  min [0, 0, 0]
  max [2, 4, 1]
  state closed
}

anim door_open {
  group door
  guard closed          # Only runs if group.state === "closed"
  rotate 0 to 90 for 2 pivot [0, 0, 0] axis [0, 1, 0]
  state open            # Sets group.state on completion
}
```
**Keyframe types**: `rotate`, `move [x|y|z]`, `wait`

**Critical flow**:
1. Parse DSL → `animSystem.parse(dsl)`
2. Assign voxels → `animSystem.assignVoxelsToGroups(chunk)`
3. Register groups → `chunk.addGroup(name, min, max)`
4. Rebuild meshes → `buildAllMeshes()` (creates separate VAOs per group)

### 7. Multi-Mesh Rendering
In render loop, render main mesh + per-group meshes with transforms:
```javascript
renderProg.uModel.set(model);  // Identity for main mesh
gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, ...);

Object.keys(renderProg.meta.groups).forEach(name => {
  const transform = animSystem.getGroupTransform(name);
  const groupModel = Mat4.multiply(model, transform);
  renderProg.uModel.set(groupModel);
  gl.drawElements(..., group.indexCount, ...);
});
```

## Undo/Redo System
**Action-based with composability**:
```javascript
const act = beginVoxelAction('Paint plane');
for (const id of voxels) recordVoxelChange(act, id, toSolid, toMat);
commitAction(act, rebuild=true);  // Adds to undoStack, clears redoStack
```
- Stores before/after state: `{ idx, fromS, fromM, toS, toM }`
- Also supports palette changes: `beginPaletteAction` + `recordPaletteChange`
- **Don't manually rebuild meshes** if `commitAction(act, true)` is called

## Editing Modes & Tools
**Modes**: `paint` (change material), `carve` (remove), `add` (place)
**Tools**: `voxel` (single), `row` (along axis), `plane` (entire slice)

**Row/Plane logic**:
- `getRowSurfaceVoxels(vIdx, faceId)`: Voxels along constant U,V coordinates
- `getPlaneAddTargets(vIdx, faceId)`: Empty neighbors of all surface voxels on a plane
- **Face info lookup**: `FACE_INFO[faceId] = { axis, u, v }` for UV decomposition

## Common Tasks

### Adding a New Shader Pair
1. Create `src/myshader.vert` and `src/myshader.frag`
2. Import in `main.js`: `import myVert from './myshader.vert'`
3. Create program: `const myProg = createProgram(gl, myVert, myFrag)`
4. Access uniforms: `myProg.uMatrix.set(mat4Array)`

### Adding Animation Keyframe Type
1. Add DSL parsing in `AnimationSystem.parse()` (switch on `cmd`)
2. Store keyframe: `currentAnim.keyframes.push({ type: 'mytype', ... })`
3. Implement in `Animation._updateGroupTransform()` (switch on `kf.type`)
4. Update `toJSON/fromJSON` if needed

### Extending UI
1. Add state to `uiState` in `main.js`
2. Access in `ui.js` via destructuring: `const { newState } = state;`
3. Add event listeners in `initializeUI(state)`
4. Update hover previews in `updateHover()` if affecting rendering

### Performance Notes
- **Greedy meshing** reduces draw calls ~100x vs naïve cubes
- Picking uses lazy FBO updates (only on mouse move)
- Animation transforms recompute every frame (acceptable for ~10 groups)

## File Organization
```
src/
  main.js              # Entry point, app state, render loop
  ui.js                # Event handlers (mouse, keyboard, buttons)
  voxel-chunk.js       # VoxelChunk class (data + meshing)
  AnimationSystem.js   # DSL parser, animation registry
  Animation.js         # Per-animation logic, transform calculation
  AnimationGroup.js    # Group bounds, state, voxel membership
  webgl.js             # Program wrapper with introspection
  3d.js                # OrbitCamera, wireframe helpers
  math.js              # Mat4, Vec3 utilities
  palette.js           # 16-color palette UI
  *.vert, *.frag       # GLSL shaders (imported as strings)
  style.css            # Toolbar, panel styling
```

## Gotchas
- **Coordinate order matters**: `idx3(x,y,z)` but loops often go `z→y→x`
- **Groups exclude voxels from main mesh**: Check `buildGreedyRenderMeshMain`'s `isSolid` predicate
- **Ground plane is face 6**: Special case in picking (not voxel-backed)
- **Animation guards are strings**: Check `group.state === anim.guard` (case-sensitive)
- **Palette is shared Float32Array**: Upload via `renderProg.uPalette.set(palette.colors)`
