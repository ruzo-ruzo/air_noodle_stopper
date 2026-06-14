import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader';
import { OrbitControls } from 'three/addons/Addons.js';

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

let mask = null;
let mindarThree = null;
let avatar = null;
let clock = null;

//↓MindAR版と差異がある
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
    scene.background = new THREE.Color('#555555');
    
    // 見やすいようにヘルパー（網目）を設定
    let gridHelper = new THREE.GridHelper();
    scene.add(gridHelper);
    
    // カメラを作成
    const camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.1, 1000);
    camera.position.set(5, 2, 0);
    camera.lookAt(0, 0, 0);

    // ライトの作成
    const amb_light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(amb_light);
    const main_light = new THREE.DirectionalLight(0xFFFFFF, 1);
    main_light.position.set(1, 3, 5);
    scene.add(main_light);
    
    // マウス制御
    const controls = new OrbitControls(camera, renderer.domElement);
    
    mindarThree = { renderer, scene, camera };

    avatar = new Loader();
    await avatar.init('./venetim.glb');
    avatar.gltf.scene.scale.set(0.7, 0.7, 0.7);
    scene.add(avatar.gltf.scene);　//MindMR側だとアンカーを追加してる部分
    
    mask = new Loader();
    await mask.init('./mask.glb');
    mask.gltf.scene.scale.set(0.7 ,0.7 ,0.7);
    // mask.gltf.scene.traverse((object) => {
        // if(object.isMesh) { 
            // object.material.colorWrite = false;
            // object.renderOrder = -1;
        // }
    // });
    scene.add(mask.gltf.scene);
}

const start = async () => {
    if (!mindarThree) {
        await setup();
    }
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
