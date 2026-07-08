import * as THREE from 'three';
import { OrbitControls } from 'three/addons/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { EXRLoader } from 'three/addons/loaders/EXRLoader';

class Loader {
    constructor() {
      this.gltf = null;
      this.morphTargetMeshes = [];
    }
    async init(url, first_action_name) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./scripts/draco_decoder/');
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
let mask = null;
let mindarThree = null;
let avatar = null;
let clock = null;

// MindAR版と差異がある
const setup = async () => {
    // 画面サイズの取得
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // レンダラーの作成
    const canvas = document.getElementById('container');
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(windowWidth, windowHeight);

    // シーンの作成
    const scene = new THREE.Scene();
    
    // カメラを作成
    const camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.1, 1000);
    camera.position.set(2, 2, 0);
    camera.lookAt(0, 0, 0);
    
    // 背景と環境光追加
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
    new EXRLoader().load('./images/relax_inn_seaview_suite_1k.exr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
    });
    new EXRLoader().load('./images/relax_inn_seaview_suite_4k.exr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
    });
    
    // マウス制御
    const controls = new OrbitControls(camera, renderer.domElement);
    
    // 本来は必要ないがMindAR版と表記を近づけるためのラッパー
    mindarThree = { renderer, scene, camera };

    // メインキャラクター設置
    avatar = new Loader();
    await avatar.init('./models/venetim.glb');
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    scene.add(avatar.gltf.scene);　//MindMR側だとアンカーを追加してる部分
    avatar.gltf.scene.rotation.y = Math.PI / 2; //カメラ位置へ向ける
    
    //　以下本来はマスク用だがビューワでは表示する
    mask = new Loader();
    await mask.init('./models/mask.glb');
    mask.gltf.scene.scale.set(0.7 ,0.7 ,0.7);
    mask.gltf.scene.rotation.y = Math.PI / 2; //カメラ位置へ向ける
    scene.add(mask.gltf.scene);
}

// MindAR版と差異がある
const start = async () => {
    if (!mindarThree) {
        await setup();
    }
    const { renderer, scene, camera } = mindarThree;
    clock = new THREE.Clock();
    renderer.setAnimationLoop(animation_update);
}

const animation_update = () => {
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
    const mixer = avatar.mixer;
    if (mixer) mixer.update(clock.getDelta());
    const { renderer, scene, camera } = mindarThree;
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
