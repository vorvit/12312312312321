/**
 * Упрощенная версия viewer без сложной аутентификации
 * Загружает файлы напрямую через mock API
 */

import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

// Глобальные переменные
let world: any;
let components: OBC.Components;
let fragments: OBF.FragmentsManager;
let ifcLoader: OBC.IfcLoader;
let preloadedModels: Map<string, any> = new Map();
let filesLoaded = false; // Флаг для предотвращения повторной загрузки

// Инициализация компонентов
async function initializeComponents() {
  console.log('Initializing components...');
  
  components = new OBC.Components();
  world = components.get(OBC.SimpleWorld);
  
  // Настройка рендерера
  world.renderer.setSize(window.innerWidth, window.innerHeight);
  world.renderer.shadowMap.enabled = true;
  world.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Настройка камеры
  world.camera.setup();
  world.camera.controls.setLookAt(10, 10, 10, 0, 0, 0);
  
  // Настройка освещения
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  world.scene.three.add(directionalLight);
  
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  world.scene.three.add(ambientLight);
  
  // Проверяем доступность WASM файлов
  console.log('Checking WASM files availability...');
  try {
    const wasmUrl = "https://unpkg.com/web-ifc@0.0.70/web-ifc.wasm";
    const wasmResponse = await fetch(wasmUrl, { method: 'HEAD' });
    console.log(`WASM file check: ${wasmResponse.status === 200 ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.warn('WASM file check failed:', error);
  }
  
  // Настройка ifcLoader с обработкой ошибок
  ifcLoader = components.get(OBC.IfcLoader);
  console.log('Setting up IFC loader...');
  try {
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.70/" },
    });
    console.log('IFC loader setup completed');
  } catch (error) {
    console.error('IFC loader setup FAILED:', error);
    console.error('This might be due to WASM files not being available');
    throw error; // Пробрасываем ошибку дальше
  }
  
  // Настройка fragments с обработкой ошибок
  console.log('Setting up Fragments manager...');
  try {
    fragments = components.get(OBF.FragmentsManager);
    await fragments.init();
    console.log('Fragments manager initialized');
  } catch (error) {
    console.error('Fragments manager setup FAILED:', error);
    throw error;
  }
  
  console.log('Components initialized successfully');
}

// Загрузка файлов через mock API
async function loadUserFiles() {
  // Для отладки временно отключаем проверку localStorage
  // if (filesLoaded) {
  //   console.log('Files already loaded, skipping...');
  //   return;
  // }
  
  console.log('Loading user files via mock API...');
  
  try {
    // Получаем токен из URL или localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || localStorage.getItem('access_token');
    
    console.log('Token found:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.error('No token available');
      return;
    }
    
    // Загружаем список файлов
    console.log('Fetching files list from API...');
    const response = await fetch('http://localhost:8000/api/mock/files', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Files loaded:', data);
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`Found ${data.data.length} files, loading IFC files...`);
      
      let loadedCount = 0;
      // Загружаем каждый IFC файл
      for (const file of data.data) {
        if (file.is_ifc) {
          console.log(`Loading IFC file: ${file.name}`);
          await loadIFCFile(file);
          loadedCount++;
        }
      }
      
      console.log(`Successfully loaded ${loadedCount} IFC files`);
      
      // Отмечаем, что файлы загружены
      filesLoaded = true;
      // localStorage.setItem('files_loaded', 'true');
    } else {
      console.log('No IFC files found to load');
    }
    
  } catch (error) {
    console.error('Error loading user files:', error);
    console.error('Error details:', error.message);
  }
}

// Загрузка одного IFC файла
async function loadIFCFile(file: any) {
  console.log(`Loading IFC file: ${file.name}`);
  
  try {
    // Скачиваем файл
    const downloadUrl = `http://localhost:8000${file.mock_url}`;
    console.log(`Downloading from: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      }
    });
    
    console.log(`Download response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${file.name}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log(`Downloaded ${bytes.length} bytes`);
    
    // Загружаем в ifcLoader
    const modelName = file.name.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
    console.log(`Loading into IFC loader with name: ${modelName}`);
    
    await ifcLoader.load(bytes, true, modelName);
    
    console.log(`IFC file ${file.name} loaded successfully`);
    
    // Проверяем, что модель добавилась в fragments
    console.log(`Fragments list size: ${fragments.list.size}`);
    console.log(`Available fragments:`, Array.from(fragments.list.keys()));
    
    // Добавляем в preloadedModels
    const model = fragments.list.get(modelName);
    if (model) {
      console.log(`Model ${modelName} found in fragments`);
      preloadedModels.set(modelName, model);
      model.visible = false; // Скрываем по умолчанию
      
      // Убираем модель из сцены, если она там есть
      if (model.object && world.scene.three.children.includes(model.object)) {
        world.scene.three.remove(model.object);
      }
      
      console.log(`Model ${modelName} added to preloadedModels`);
    } else {
      console.error(`Model ${modelName} NOT found in fragments after loading!`);
    }
    
  } catch (error) {
    console.error(`Error loading ${file.name}:`, error);
    console.error(`Error details:`, error.message);
  }
}

// Создание простого UI
function createSimpleUI() {
  console.log('Creating simple UI...');
  
  const appElement = document.getElementById('app');
  if (!appElement) {
    console.error('App element not found');
    return;
  }
  
  // Создаем простой интерфейс
  appElement.innerHTML = `
    <div style="position: absolute; top: 10px; left: 10px; z-index: 1000; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 5px; color: white;">
      <h3>Simple IFC Viewer</h3>
      <div id="models-list"></div>
      <button id="load-files-btn" style="margin-top: 10px; padding: 5px 10px;">Load Files</button>
      <button id="test-wasm-btn" style="margin-top: 5px; padding: 5px 10px; background: #ff6b6b;">Test WASM</button>
      <div id="debug-info" style="margin-top: 10px; font-size: 10px; color: #ccc;"></div>
    </div>
  `;
  
  // Обработчик кнопки загрузки файлов
  const loadBtn = document.getElementById('load-files-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadUserFiles);
  }
  
  // Обработчик кнопки тестирования WASM
  const testBtn = document.getElementById('test-wasm-btn');
  if (testBtn) {
    testBtn.addEventListener('click', testWASMAvailability);
  }
  
  // Обновляем список моделей
  updateModelsList();
}

// Тестирование доступности WASM файлов
async function testWASMAvailability() {
  console.log('Testing WASM files availability...');
  const debugInfo = document.getElementById('debug-info');
  
  try {
    const wasmUrl = "https://unpkg.com/web-ifc@0.0.70/web-ifc.wasm";
    const workerUrl = "https://unpkg.com/web-ifc@0.0.70/web-ifc-mt.worker.js";
    
    const wasmResponse = await fetch(wasmUrl, { method: 'HEAD' });
    const workerResponse = await fetch(workerUrl, { method: 'HEAD' });
    
    const status = `
      WASM: ${wasmResponse.status === 200 ? '✅' : '❌'} (${wasmResponse.status})
      Worker: ${workerResponse.status === 200 ? '✅' : '❌'} (${workerResponse.status})
    `;
    
    console.log(status);
    if (debugInfo) {
      debugInfo.innerHTML = status;
    }
    
  } catch (error) {
    console.error('WASM test failed:', error);
    if (debugInfo) {
      debugInfo.innerHTML = `WASM test failed: ${error.message}`;
    }
  }
}

// Обновление списка моделей
function updateModelsList() {
  const modelsList = document.getElementById('models-list');
  if (!modelsList) return;
  
  modelsList.innerHTML = '';
  
  if (preloadedModels.size === 0) {
    modelsList.innerHTML = '<div style="color: #ccc;">No models loaded</div>';
    return;
  }
  
  for (const [id, model] of preloadedModels) {
    const modelElement = document.createElement('div');
    modelElement.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px;
      margin: 2px 0;
      border: 1px solid #444;
      border-radius: 3px;
      background: #333;
    `;
    
    modelElement.innerHTML = `
      <span style="color: white; font-size: 12px;">${id}</span>
      <button 
        onclick="toggleModel('${id}', ${model.visible})"
        style="
          background: ${model.visible ? '#dc3545' : '#28a745'};
          color: white;
          border: none;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
        "
      >
        ${model.visible ? 'Hide' : 'Show'}
      </button>
    `;
    
    modelsList.appendChild(modelElement);
  }
}

// Глобальная функция для переключения видимости модели
(window as any).toggleModel = function(modelId: string, currentVisible: boolean) {
  const model = preloadedModels.get(modelId);
  if (model) {
    model.visible = !currentVisible;
    
    // Переключаем видимость модели в сцене
    if (model.visible) {
      // Показываем модель
      if (model.object) {
        world.scene.three.add(model.object);
      }
    } else {
      // Скрываем модель
      if (model.object) {
        world.scene.three.remove(model.object);
      }
    }
    
    // Обновляем UI
    updateModelsList();
    console.log(`Model ${modelId} visibility: ${model.visible}`);
  }
};

// Инициализация
async function init() {
  try {
    console.log('Starting simple viewer initialization...');
    
    await initializeComponents();
    createSimpleUI();
    
    // Загружаем файлы автоматически
    await loadUserFiles();
    
    console.log('Simple viewer initialized successfully');
    
  } catch (error) {
    console.error('Error initializing simple viewer:', error);
  }
}

// Запуск
init();
