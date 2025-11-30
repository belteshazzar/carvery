import { Mat4 } from './math.js';


// https://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html
/**
 * SceneNode represents a node in a hierarchical scene graph.
 * Each node has a local transform and can have child nodes.
 * The world transform is computed by multiplying parent transforms.
 */
export class SceneNode {
  /**
   * Creates a new scene node.
   * 
   * @param {string} name - Name of the node
   * @param {Object} options - Node configuration
   * @param {Float32Array} [options.localTransform] - Initial local transform matrix
   * @param {number} [options.materialId] - Material ID for rendering
   * @param {Object} [options.mesh] - Mesh data (vao, indexCount)
   */
  constructor(name, { localTransform = null, materialId = 0, mesh = null } = {}) {
    this.name = name;
    this.localTransform = localTransform || Mat4.identity();
    this.worldTransform = Mat4.identity();
    this.materialId = materialId;
    this.mesh = mesh;
    this.children = [];
    this.parent = null;
  }

  /**
   * Adds a child node to this node.
   * 
   * @param {SceneNode} child - The child node to add
   * @returns {SceneNode} The child node (for chaining)
   */
  addChild(child) {
    this.children.push(child);
    child.parent = this;
    return child;
  }

  /**
   * Removes a child node from this node.
   * 
   * @param {SceneNode} child - The child node to remove
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  /**
   * Sets the local transform matrix for this node.
   * 
   * @param {Float32Array} transform - The new local transform matrix
   */
  setLocalTransform(transform) {
    this.localTransform = transform;
  }

  /**
   * Updates the world transform for this node and all children.
   * Should be called from the root node each frame.
   * 
   * @param {Float32Array} [parentTransform] - Parent's world transform
   */
  updateWorldTransform(parentTransform = null) {
    if (parentTransform) {
      this.worldTransform = Mat4.multiply(parentTransform, this.localTransform);
    } else {
      this.worldTransform = this.localTransform;
    }

    // Update all children recursively
    for (const child of this.children) {
      child.updateWorldTransform(this.worldTransform);
    }
  }

  /**
   * Traverses the scene graph and calls a callback for each node.
   * 
   * @param {Function} callback - Function to call for each node (receives the node)
   */
  traverse(callback) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  /**
   * Finds a node by name in this subtree.
   * 
   * @param {string} name - Name of the node to find
   * @returns {SceneNode|null} The found node or null
   */
  findByName(name) {
    if (this.name === name) {
      return this;
    }
    for (const child of this.children) {
      const found = child.findByName(name);
      if (found) return found;
    }
    return null;
  }
}
