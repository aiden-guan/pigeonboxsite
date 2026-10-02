import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { clone } from '../vendor/addons/utils/SkeletonUtils.js';

// Retain the live rig and shader bindings while adopting authored geometry.
// Validate the whole asset before mutation: a stale export leaves the working
// procedural fallback intact. Runtime-deformed flag cloth stays procedural.
export function adoptModelGeometry(root, model) {
  const replacements=[];
  function visit(object,route) {
    if(object.isMesh&&!object.userData.runtimeGeometry){
      const asset=model.getObjectByName(`part_${route}`);
      if(!asset?.isMesh||Boolean(asset.isInstancedMesh)!==Boolean(object.isInstancedMesh))throw new Error(`Incompatible model part ${route}`);
      if(object.isInstancedMesh&&asset.count!==object.count)throw new Error(`Incompatible instance count ${route}`);
      replacements.push([object,asset.geometry]);
    }
    object.children.forEach((child,i)=>visit(child,`${route}_${i}`));
  }
  visit(root,'0');
  const previous=new Set();
  for(const [object,geometry] of replacements){previous.add(object.geometry);object.geometry=geometry;}
  previous.forEach(geometry=>geometry.dispose());
  root.userData.authoredModel=true;
  return replacements.length;
}

// One loader and one request per URL. Instances share immutable geometry and
// textures; callers own their transforms. Dispose the store after its world.
export function createAssetStore({ onProgress = () => {} } = {}) {
  const loader = new GLTFLoader();
  const cache = new Map();
  const originals = new Set();
  const records = new Map();
  let disposed = false;
  const report = () => onProgress([...records].map(([url, record]) => ({ url, ...record })));

  function disposeScene(scene) {
    const resources = new Set();
    scene.traverse((object) => {
      if (object.geometry) resources.add(object.geometry);
      for (const material of [object.material].flat().filter(Boolean)) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      }
    });
    for (const resource of resources) resource.dispose();
  }

  function preload(url) {
    if (disposed) return Promise.reject(new Error('Asset store disposed'));
    if (cache.has(url)) return cache.get(url);
    records.set(url, { status: 'loading', loaded: 0, total: null });
    report();
    const request = new Promise((resolve, reject) => {
      loader.load(url, (gltf) => {
        if (disposed) {
          disposeScene(gltf.scene);
          reject(new Error('Asset store disposed'));
          return;
        }
        originals.add(gltf.scene);
        records.set(url, { ...records.get(url), status: 'ready' });
        report();
        resolve(gltf);
      }, (event) => {
        records.set(url, { status: 'loading', loaded: event.loaded, total: event.lengthComputable ? event.total : null });
        report();
      }, (error) => {
        records.set(url, { ...records.get(url), status: 'failed' });
        cache.delete(url); // A later visit can retry a transient failure.
        report();
        reject(error);
      });
    });
    cache.set(url, request);
    return request;
  }

  return {
    preload,
    async instantiate(url, fallback) {
      try {
        const gltf = await preload(url);
        if (disposed) return null;
        const scene = clone(gltf.scene);
        scene.traverse((object) => {
          if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
        });
        return { scene, animations: gltf.animations, fallback: false };
      } catch (error) {
        if (disposed) return null;
        if (!fallback) return null;
        return { scene: fallback(), animations: [], fallback: true };
      }
    },
    get progress() { return [...records].map(([url, record]) => ({ url, ...record })); },
    dispose() {
      disposed = true;
      originals.forEach(disposeScene);
      originals.clear(); cache.clear(); records.clear();
    },
  };
}
