import * as THREE from 'three';
import { OrbitControls } from 'three/addons/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { EXRLoader } from 'three/addons/loaders/EXRLoader';

// MindAR版と同じ
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
let mask = null;
let clock = null;

const setup = () => {
    // 画面サイズの取得
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // レンダラーの作成
    const canvas = document.getElementById('container');
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(windowWidth, windowHeight);
    
    // カメラを作成
    const camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.1, 1000);

    // マウス制御
    const controls = new OrbitControls(camera, renderer.domElement);
 
    // シーンの作成
    const scene = new THREE.Scene();

    clock = new THREE.Clock();
 
    // 本来は必要ないがMindAR版と表記を近づけるためのラッパー
    mindarThree = { renderer, scene, camera };

    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
}

const loading = async () => {
    await render_loading_screen();
    
    // 実際のロード
    return await Promise.all([
        new EXRLoader().loadAsync('./images/relax_inn_seaview_suite_1k.exr'),
        new EXRLoader().loadAsync('./images/relax_inn_seaview_suite_4k.exr'),
        new SetGltf('./models/venetim.glb').init(),
        new SetGltf('./models/mask.glb').init(),
    ])
}

const render_loading_screen = async () => {
    const { renderer, scene, camera } = mindarThree;

    // ローディング専用シーン追加
    const loading_scene = new THREE.Scene();
    loading_scene.background = new THREE.Color(0xe0d0d0);

    // カメラ位置調整
    camera.position.set(0, 0.5, 1);
    camera.lookAt(0, 0.1, 0);

    // ローディング用モデル表示
    const loading_model = await new SetGltf('./models/loading.glb').init();
    loading_scene.add(loading_model.gltf.scene);
    loading_model.gltf.scene.scale.set(0.5 ,0.5 ,0.5);

    //　アニメーション設定
    const action = loading_model.actions['Loading'];
    action.setLoop(THREE.LoopRepeat);
    action.enabled = true;
    action.play();
    renderer.setAnimationLoop(()=>{
        if (loading_model.mixer) loading_model.mixer.update(clock.getDelta());
        renderer.render(loading_scene, camera);
    });

    // clock = new THREE.Clock();
    renderer.clear();
}

const initilize = ([environment, background, character, mask]) => {
    const { renderer, scene, camera } = mindarThree;
    avatar = character;

    // カメラ調整
    camera.position.set(2, 2, 0);
    camera.lookAt(0, 0, 0);

    // 環境光
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = environment;
    
    // 背景（MindAR版には不要）
    background.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = background;

    // メインキャラクター
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    scene.add(avatar.gltf.scene);　//MindMR側だとアンカーを追加してる部分
    avatar.gltf.scene.rotation.y = Math.PI / 2; //カメラ位置へ向ける

    //　以下本来はマスク用だがビューワでは表示する
    mask.gltf.scene.scale.set(0.7 ,0.7 ,0.7);
    mask.gltf.scene.rotation.y = Math.PI / 2; //カメラ位置へ向ける
    scene.add(mask.gltf.scene);
}

const start = async () => {
    if (!mindarThree) setup();
    const { renderer, scene, camera } = mindarThree;
    initilize(await loading());
    renderer.setAnimationLoop(animation_update);
}

// MindAR版と同じ
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

// MindAR版と同じ
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
