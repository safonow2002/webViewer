let scene, camera, renderer, controls, currentModel;

init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    // 1. Создание сцены
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // 2. Создание камеры
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    // 3. Создание рендерера
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 4. Управление камерой (вращение, зум мышкой)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 5. Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x555555, 0.5);
    dirLight2.position.set(-5, -10, -7);
    scene.add(dirLight2);

    // 6. Обработчик загрузки файла
    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    // 7. Поддержка изменения размеров окна
    window.addEventListener('resize', onWindowResize);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    // Читаем файл как текстовую строку (данные OBJ)
    reader.onload = function (e) {
        const contents = e.target.result;
        loadOBJModel(contents);
    };
    
    reader.readAsText(file);
}

function loadOBJModel(textData) {
    // Удаляем предыдущую модель, если она была
    if (currentModel) {
        scene.remove(currentModel);
    }

    const loader = new THREE.OBJLoader();
    // Парсим текст в 3D объект Three.js
    currentModel = loader.parse(textData);

    // Применяем стандартный материал к модели, если у неё нет своих текстур
    currentModel.traverse(function (child) {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x90caf9,
                roughness: 0.4,
                metalness: 0.2
            });
        }
    });

    // Центрируем модель на экране и масштабируем её
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Сдвигаем модель в начало координат (0,0,0)
    currentModel.position.x += (currentModel.position.x - center.x);
    currentModel.position.y += (currentModel.position.y - center.y);
    currentModel.position.z += (currentModel.position.z - center.z);

    // Сбрасываем камеру под размер модели
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(0, 0, maxDim * 2);
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(currentModel);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
