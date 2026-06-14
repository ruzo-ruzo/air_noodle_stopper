import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { MindARThree } from 'mindar-image-three';

class Loader {
    constructor() {
      this.gltf = null;
      this.morphTargetMeshes = [];
    }
    async init(url) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco_decoder/');
        const gltf = await new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(url, (gltf) => {
                resolve(gltf);
            });
        });
        if (gltf.animations && gltf.animations.length > 1) {
          this.mixer = new THREE.AnimationMixer(gltf.scene);
          this.action = this.mixer.clipAction(gltf.animations[0]);
        }
      this.gltf = gltf;
    }
}

let mindarThree = null;
let avatar = null;
let mask = null;
let clock = null;

const setup = async () => {
    mindarThree = new MindARThree({
        container: document.querySelector("#container"),
        imageTargetSrc: "./marker.mind",
        filterMinCF: 0.0001,
        filterBeta: 0.001,
    });
    const { renderer, scene, camera } = mindarThree;    
    const anchor = mindarThree.addAnchor(0);

    const amb_light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(amb_light);
    const main_light = new THREE.DirectionalLight(0xFFFFFF, 1);
    main_light.position.set(1, 3, 5);
    scene.add(main_light);
    
    avatar = new Loader();
    await avatar.init('./venetim.glb');
    avatar.gltf.scene.rotation.x = Math.PI / 2;
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    anchor.group.add(avatar.gltf.scene);

    mask = new Loader();
    await mask.init('./mask.glb');
    mask.gltf.scene.rotation.x = Math.PI / 2;
    mask.gltf.scene.scale.set(0.7, 0.7, 0.7);
    mask.gltf.scene.traverse((object) => {
        if(object.isMesh) { 
            object.material.colorWrite = false;
            object.renderOrder = -1;
        }
    });
    anchor.group.add(mask.gltf.scene);
}

const start = async () => {
    if (!mindarThree) {
        await setup();
    }
    await mindarThree.start();
    const { renderer, scene, camera } = mindarThree;
    const mixer = avatar.mixer;
    clock = new THREE.Clock();
    avatar.action.play();
    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        renderer.render(scene, camera);
    });
}
start();
