import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { MindARThree } from 'mindar-image-three';

class Loader {
    constructor() {
      this.gltf = null;
      this.morphTargetMeshes = [];
    }
    async init(url, first_action_name) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco_decoder/');
        const gltf = await new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(url, (gltf) => {
                resolve(gltf);
            });
        });
        if (gltf.animations) {
            this.mixer = new THREE.AnimationMixer(gltf.scene);
            this.actions = {};
            gltf.animations.forEach((animation) => {
                const action = this.mixer.clipAction(animation);
                this.actions[animation.name] = action;
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                action.enabled = false;
            });
        }
        this.gltf = gltf;
    }
}

let mindarThree = null;
let avatar = null;
let mask = null;
let clock = null;
let anchor = null;

const setup = async () => {
    // MindAR関係のセッティング
    mindarThree = new MindARThree({
        container: document.querySelector("#container"),
        imageTargetSrc: "./marker.mind",
        filterMinCF: 0.0001,
        filterBeta: 0.001,
    });
    const { renderer, scene, camera } = mindarThree;    
    anchor = mindarThree.addAnchor(0);

    // ライトの作成
    const amb_light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(amb_light);
    const main_light = new THREE.DirectionalLight(0xFFFFFF, 1);
    main_light.position.set(1, 3, 5);
    scene.add(main_light);
    
    // メインキャラクター設置
    avatar = new Loader();
    await avatar.init('./venetim.glb');
    avatar.gltf.scene.rotation.x = Math.PI / 2;
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    anchor.group.add(avatar.gltf.scene);

    // マスク用メッシュ設置
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
    const actions = avatar.actions;
    clock = new THREE.Clock();
    renderer.setAnimationLoop(animation_update);
    // ↓ターゲットを認識した時にアニメーションを初期化する
    anchor.onTargetFound = () => {
        Object.keys(actions).forEach((name) => { actions[name].enabled = false; });
    }
}

const animation_update = () => {
    const { renderer, scene, camera } = mindarThree;
    const mixer = avatar.mixer;
    const delta = clock.getDelta();
    const action_names = Object.keys(avatar.actions);
    const current_name = action_names.find(action => avatar.actions[action].enabled);
    const current_action = avatar.actions[current_name];
    const is_first_time = !current_name;
    if ( is_first_time || current_action.paused) {
        if (current_action) current_action.enabled = false;
        let next_action_name = get_next_action_name(current_name);
        const next_action = avatar.actions[next_action_name];
        next_action.enabled = true;
        next_action.reset();
        next_action.play();
    }
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}

const get_next_action_name = (current_name) => {
    if (current_name) {
        if ( current_name != 'Wait' ) {
            // Wait以外のアクションは連続させずWaitを挟む
            return 'Wait';
        } else {
            const hit = Math.floor(Math.random() * 5 );
            switch (hit) {
                case 0: return 'Wave';
                case 1: return 'Talk';
                default: return 'Wait';
            }
        }
    } else {
        // 初回
        return 'Fall';
    }
}

start();
