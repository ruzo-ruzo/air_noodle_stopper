import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { EXRLoader } from 'three/addons/loaders/EXRLoader';
import { MindARThree } from 'mindar-image-three';

class SetGltf {
    constructor(url) {
        this.url = url;
    }
    async init() {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./scripts/draco_decoder/');
        const gltf = new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(this.url, (gltf) => {
                const wrapper = {};
                if (gltf.animations) {
                    wrapper.mixer = new THREE.AnimationMixer(gltf.scene);
                    wrapper.actions = {};
                    gltf.animations.forEach((animation) => {
                        const action = wrapper.mixer.clipAction(animation);
                        wrapper.actions[animation.name] = action;
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = true;
                        action.enabled = false;
                    });
                }
                wrapper.gltf = gltf;
                resolve(wrapper);
            });
        });
        return gltf;
    }
}

let mindarThree = null;
let avatar = null;
let clock = null;
let anchor = null;

const setup = () => {
    // MindAR関係のセッティング
    mindarThree = new MindARThree({
        container: document.querySelector("#container"),
        imageTargetSrc: "./marker.mind",
        filterMinCF: 0.0001,
        filterBeta: 0.001,
    });
    const { renderer, scene, camera } = mindarThree;    
    anchor = mindarThree.addAnchor(0);
    clock = new THREE.Clock();

    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
}

const loading = async () => {
    return await Promise.all([
        new EXRLoader().loadAsync('./images/relax_inn_seaview_suite_1k.exr'),
        new SetGltf('./models/venetim.glb').init(),
        new SetGltf('./models/mask.glb').init(),
    ])
}

const initilize = ([environment, character, mask]) => {
    const { renderer, scene, camera } = mindarThree;
    avatar = character;
    
    // 環境光
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = environment;

    // メインキャラクター
    avatar.gltf.scene.rotation.x = Math.PI / 2;
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    anchor.group.add(avatar.gltf.scene);

    //　マスク
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
    if (!mindarThree) setup();
    await mindarThree.start();
    const { renderer, scene, camera } = mindarThree;
    initilize(await loading());
    const actions = avatar.actions;
    renderer.setAnimationLoop(animation_update);
    // ↓ターゲットを認識した時にアニメーションを初期化する
    anchor.onTargetFound = () => {
        Object.keys(actions).forEach((name) => { actions[name].enabled = false; });
    }
}

const animation_update = () => {
    const { renderer, scene, camera } = mindarThree;
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
    if (avatar.mixer) avatar.mixer.update(clock.getDelta());
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
                case 2: return 'Scroll';
                default: return 'Wait';
            }
        }
    } else {
        // 初回
        return 'Fall';
    }
}

start();
