let scene, camera, renderer, controls, transformControls;
let currentModel, gui;
let raycaster, mouse;




// Объект глобальных настроек для меню GUI
const settings = {
    // Освещение
    lightIntensity: 1.0,
    lightColor: '#ffffff',
    bgColor: '#1a1a1a',
    // Визуализация
    showTextures: true,
    wireframe: false,
    modelColor: '#90caf9',
    // Трансформации частей
    transformMode: 'translate', // 'translate' или 'rotate'
    // Экспорт
    exportModel: function() { saveModel(); }
};

// Запуск только после того, как весь HTML полностью построился
window.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

function init() {
    const container = document.getElementById('canvas-container');

    // 1. Сцена и Рендерер
    scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.bgColor);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Камера и Навигация
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 3. Инструмент трансформации (Стрелки для движения/вращения частей)
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75;
    // Блокируем вращение камеры, когда юзер тянет за стрелки трансформации
    transformControls.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });
    scene.add(transformControls);

    // 4. Освещение
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    mainLight = new THREE.DirectionalLight(settings.lightColor, settings.lightIntensity);
    mainLight.position.set(10, 20, 15);
    scene.add(mainLight);

    const extraLight = new THREE.DirectionalLight(0xffffff, 0.3);
    extraLight.position.set(-10, -10, -10);
    scene.add(extraLight);

    // 5. Выбор деталей мышкой (Raycasting)
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('pointerdown', onPointerDown);

    // 6. Логика интерфейса
    document.getElementById('file-input').addEventListener('change', handleFiles);
    window.addEventListener('resize', onWindowResize);

    buildGUI();
}

// Построение панели управления (lil-gui)
function buildGUI() {
    if (gui) gui.destroy();
    gui = new lil.GUI({ title: 'Настройки сцены' });

    const fScene = gui.addFolder('Окружение');
    fScene.addColor(settings, 'bgColor').name('Цвет фона').onChange(v => scene.background.set(v));
    fScene.add(settings, 'lightIntensity', 0, 3, 0.1).name('Яркость света').onChange(v => mainLight.intensity = v);
    fScene.addColor(settings, 'lightColor').name('Цвет света').onChange(v => mainLight.color.set(v));

    const fDisplay = gui.addFolder('Отображение');
    fDisplay.add(settings, 'wireframe').name('Сетка (Wireframe)').onChange(v => toggleWireframe(v));
    fDisplay.add(settings, 'showTextures').name('Текстуры').onChange(v => toggleTextures(v));
    fDisplay.addColor(settings, 'modelColor').name('Цвет (без текстур)').onChange(v => updateModelColor(v));

    const fTransform = gui.addFolder('Режим манипулятора');
    fTransform.add(settings, 'transformMode', { 'Перемещение': 'translate', 'Вращение': 'rotate' })
        .name('Режим')
        .onChange(v => transformControls.setMode(v));

    gui.add(settings, 'exportModel').name('💾 Сохранить .obj');
    
    gui.open();
}

// Обработка загрузки файлов (поддержка множественного выбора: obj + mtl + png)
function handleFiles(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    let objFile = files.find(f => f.name.endsWith('.obj'));
    let mtlFile = files.find(f => f.name.endsWith('.mtl'));
    
    if (!objFile) {
        alert('Пожалуйста, выберите хотя бы один .obj файл.');
        return;
    }

    // Создаем Blob-ссылки для локальных текстур, чтобы модель их подтянула
    const fileMap = {};
    files.forEach(f => { fileMap[f.name] = URL.createObjectURL(f); });

    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
        const baseName = url.split('/').pop();
        return fileMap[baseName] || url;
    });

    if (mtlFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const mtlLoader = new THREE.MTLLoader(manager);
            const materials = mtlLoader.parse(e.target.result);
            materials.preload();
            loadOBJ(objFile, materials, manager);
        };
        reader.readAsText(mtlFile);
    } else {
        loadOBJ(objFile, null, manager);
    }
}

function loadOBJ(file, materials, manager) {
    const reader = new FileReader();
    reader.onload = function(e) {
        if (currentModel) scene.remove(currentModel);
        transformControls.detach();

        const objLoader = new THREE.OBJLoader(manager);
        if (materials) objLoader.setMaterials(materials);
        
        currentModel = objLoader.parse(e.target.result);

        // Сохраняем исходные материалы для переключения текстур
        currentModel.traverse(child => {
            if (child.isMesh) {
                child.userData.originalMaterial = child.material.clone();
                // Дефолтный материал на случай отключения текстур
                child.userData.plainMaterial = new THREE.MeshStandardMaterial({
                    color: settings.modelColor,
                    roughness: 0.5,
                    metalness: 0.1
                });
                
                // Применяем текущие настройки интерфейса к новой модели
                child.material.wireframe = settings.wireframe;
            }
        });

        // Центрирование камеры на модели
        const box = new THREE.Box3().setFromObject(currentModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, maxDim, maxDim * 1.8);
        controls.target.set(0, 0, 0);
        controls.update();

        scene.add(currentModel);
    };
    reader.readAsText(file);
}

// Клик по элементу для выбора отдельной части
function onPointerDown(event) {
    // Игнорируем клики по элементам интерфейса GUI
    if (event.clientX > window.innerWidth - 250 && event.clientY < 400) return;
    if (event.clientX < 300 && event.clientY < 150) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    if (currentModel) {
        const intersects = raycaster.intersectObjects(currentModel.children, true);
        if (intersects.length > 0) {
            // Прикрепляем стрелки трансформации к конкретной выбранной части модели
            const hitObject = intersects[0].object;
            transformControls.attach(hitObject);
        } else if (!transformControls.dragging) {
            // Снимаем выделение при клике в пустоту
            transformControls.detach();
        }
    }
}

// Функции управления отображением
function toggleWireframe(val) {
    if (!currentModel) return;
    currentModel.traverse(child => {
        if (child.isMesh) child.material.wireframe = val;
    });
}

function toggleTextures(val) {
    if (!currentModel) return;
    currentModel.traverse(child => {
        if (child.isMesh) {
            const activeWireframe = child.material.wireframe;
            child.material = val ? child.userData.originalMaterial : child.userData.plainMaterial;
            child.material.wireframe = activeWireframe;
            child.material.needsUpdate = true;
        }
    });
}

function updateModelColor(colorHex) {
    if (!currentModel) return;
    currentModel.traverse(child => {
        if (child.isMesh && child.userData.plainMaterial) {
            child.userData.plainMaterial.color.set(colorHex);
        }
    });
}

// Экспорт измененной модели и скачивание файла
function saveModel() {
    if (!currentModel) {
        alert('Нечего сохранять. Сначала загрузите модель.');
        return;
    }
    // Отключаем гизмо перед экспортом, чтобы стрелки не попали в файл
    transformControls.detach();
    
    const exporter = new THREE.OBJExporter();
    const result = exporter.parse(currentModel);
    
    const blob = new Blob([result], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modified_model.obj';
    link.click();
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
