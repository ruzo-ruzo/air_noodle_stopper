import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { MindARThree } from 'mindar-image-three';
class Avatar {
    constructor() {
      this.gltf = null;
      this.morphTargetMeshes = [];
    }
    async init() {
        const url = './benetim.glb';
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
          this.action = this.mixer.clipAction(gltf.animations[1]);
        }
      this.gltf = gltf;
    }

}
let mindarThree = null;
let avatar = null;
let clock = null;
const setup = async () => {
    mindarThree = new MindARThree({
        container: document.querySelector("#container"),
        imageTargetSrc: "./targets.mind",
        filterMinCF: 0.0001,
        filterBeta: 0.001,
    });
    const { renderer, scene, camera } = mindarThree;
    const amb_light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(amb_light);
    const main_light = new THREE.DirectionalLight(0xFFFFFF, 1);
    main_light.position.set(1, -2, 5);
    scene.add(main_light);
    const anchor = mindarThree.addAnchor(0);
    avatar = new Avatar();
    await avatar.init();
    avatar.gltf.scene.scale.set(1, 1, 1);
    anchor.group.add(avatar.gltf.scene);
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
