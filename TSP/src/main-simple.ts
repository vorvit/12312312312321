import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { AuthIntegration } from "./auth-integration";
import "./style.css";

// Declare global variables
declare global {
  interface Window {
    fileToLoad: string | null;
  }
}

// Initialize BUI Manager
BUI.Manager.init();

// Add error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Components Setup
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.name = "Main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0x1a1d23);

const viewport = BUI.Component.create<BUI.Viewport>(() => {
  return BUI.html`<bim-viewport></bim-viewport>`;
});

world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 8;

const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};

viewport.addEventListener("resize", resizeWorld);
world.dynamicAnchor = false;
components.init();
components.get(OBC.Raycasters).get(world);

const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;
edgesPass.color = new THREE.Color(0x494b50);

const aoParameters = {
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
};

const pdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

aoPass.updateGtaoMaterial(aoParameters);
aoPass.updatePdMaterial(pdParameters);

const fragments = components.get(OBC.FragmentsManager);
fragments.init(new URL("@thatopen/fragments/dist/Worker/worker.mjs", import.meta.url).href);

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod = "isLodMaterial" in material && material.isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

const ifcLoader = components.get(OBC.IfcLoader);
ifcLoader.setup({
  autoSetWasm: false,
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.70/" },
}).then(() => {
  console.log('IFC loader setup completed');
}).catch(error => {
  console.error('IFC loader setup failed:', error);
});

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#bcf124"),
    renderedFaces: 1,
    opacity: 1,
    transparent: false,
  },
});

// Clipper Setup
const clipper = components.get(OBC.Clipper);
viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// Length Measurement Setup
const lengthMeasurer = components.get(OBF.LengthMeasurement);
lengthMeasurer.world = world;
lengthMeasurer.color = new THREE.Color("#6528d7");

lengthMeasurer.list.onItemAdded.add((line) => {
  const center = new THREE.Vector3();
  line.getCenter(center);
  const radius = line.distance() / 3;
  const sphere = new THREE.Sphere(center, radius);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => lengthMeasurer.create());

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    lengthMeasurer.delete();
  }
});

// Area Measurement Setup
const areaMeasurer = components.get(OBF.AreaMeasurement);
areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");

areaMeasurer.list.onItemAdded.add((area) => {
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => {
  areaMeasurer.create();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    areaMeasurer.endCreation();
  }
});

// Define what happens when a fragments model has been loaded
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };
  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

// Handle IFC file selection from auth integration
window.addEventListener('ifc-file-selected', async (event: CustomEvent) => {
  try {
    const { filename } = event.detail;
    console.log('Showing IFC file:', filename);
    
    // Сначала скрываем все модели
    console.log('Hiding all models...');
    for (const [id, model] of fragments.list) {
      model.visible = false;
      if (world && world.scene.three.children.includes(model.object)) {
        world.scene.three.remove(model.object);
      }
    }
    
    // Показываем только выбранную модель
    const modelId = filename.replace(".ifc", "");
    auth.showModel(fragments, modelId, true, world);
    
    console.log(`IFC file ${filename} is now visible`);

  } catch (error) {
    console.error('Error handling file selection:', error);
    alert(`Error showing file: ${error.message}`);
  }
});

// Handle show file event
window.addEventListener('ifc-file-show', async (event: CustomEvent) => {
  try {
    const { filename } = event.detail;
    console.log('Showing IFC file:', filename);
    
    const modelId = filename.replace(".ifc", "");
    auth.showModel(fragments, modelId, true, world);
    console.log(`IFC file ${filename} is now visible`);
  } catch (error) {
    console.error('Error showing IFC file:', error);
  }
});

// Handle hide file event
window.addEventListener('ifc-file-hide', async (event: CustomEvent) => {
  try {
    const { filename } = event.detail;
    console.log('Hiding IFC file:', filename);
    
    const modelId = filename.replace(".ifc", "");
    auth.showModel(fragments, modelId, false, world);
    console.log(`IFC file ${filename} is now hidden`);
  } catch (error) {
    console.error('Error hiding IFC file:', error);
  }
});

// Auth Integration Setup
const auth = AuthIntegration.getInstance();

// Check for auth token and file in URL parameters
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
const fileFromUrl = urlParams.get('file');

if (tokenFromUrl) {
  localStorage.setItem('access_token', tokenFromUrl);
  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

// If file is specified in URL, load it immediately after auth initialization
if (fileFromUrl) {
  // Store the file to load after auth is initialized
  window.fileToLoad = fileFromUrl;
}

// Create simple UI with models panel and dashboard button
const createSimpleUI = () => {
  const container = document.getElementById("app");
  if (!container) return;

  // Create header with dashboard button
  const header = document.createElement('div');
  header.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 1000;
    display: flex;
    gap: 10px;
    align-items: center;
  `;
  
  const dashboardButton = document.createElement('button');
  dashboardButton.textContent = 'Back to Dashboard';
  dashboardButton.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
  `;
  dashboardButton.addEventListener('click', () => {
    window.open('http://localhost:8000/dashboard', '_blank');
  });
  
  const title = document.createElement('div');
  title.textContent = 'IFC 3D Viewer';
  title.style.cssText = 'color: #ccc; font-size: 12px;';
  
  header.appendChild(dashboardButton);
  header.appendChild(title);

  // Create models panel
  const modelsPanel = document.createElement('div');
  modelsPanel.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: #2a2d32;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 16px;
    min-width: 250px;
    color: white;
  `;
  
  const modelsTitle = document.createElement('h3');
  modelsTitle.textContent = 'Models';
  modelsTitle.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
  
  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load IFC';
  loadButton.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    margin-bottom: 16px;
  `;
  
  const modelsList = document.createElement('div');
  modelsList.id = 'models-list';
  modelsList.style.cssText = 'max-height: 200px; overflow-y: auto;';
  modelsList.innerHTML = '<div style="text-align: center; color: #ccc; padding: 20px;">No models loaded</div>';
  
  loadButton.addEventListener('click', async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      loadButton.textContent = 'Loading...';
      loadButton.disabled = true;
      
      try {
        const ifcLoader = components.get(OBC.IfcLoader);
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
        updateModelsList();
      } catch (error) {
        console.error('Error loading IFC file:', error);
        alert('Error loading IFC file');
      } finally {
        loadButton.textContent = 'Load IFC';
        loadButton.disabled = false;
      }
    });

    input.click();
  });
  
  modelsPanel.appendChild(modelsTitle);
  modelsPanel.appendChild(loadButton);
  modelsPanel.appendChild(modelsList);

  // Create IoT sensors panel
  const sensorsPanel = document.createElement('div');
  sensorsPanel.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    background: #23262b;
    color: #fff;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: sans-serif;
    min-width: 180px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  const sensorsTitle = document.createElement('h3');
  sensorsTitle.textContent = 'IoT Sensors';
  sensorsTitle.style.cssText = 'margin-top:0;';
  
  const sensorList = document.createElement('ul');
  sensorList.id = 'sensor-list';
  sensorList.style.cssText = 'list-style:none; padding:0; margin:0;';
  
  sensorsPanel.appendChild(sensorsTitle);
  sensorsPanel.appendChild(sensorList);

  container.appendChild(header);
  container.appendChild(modelsPanel);
  container.appendChild(sensorsPanel);
  container.appendChild(viewport);
};

// Initialize UI
createSimpleUI();

// Initialize auth and load user files
let isAuthenticated = false;
let userFiles: any[] = [];

async function initializeAuth() {
  isAuthenticated = await auth.checkAuth();
  console.log('Auth status:', isAuthenticated);
  
  if (isAuthenticated) {
    // Load user files every time user enters viewer
    userFiles = await auth.loadUserFiles();
    console.log('Loaded user files:', userFiles);
    
    // Предзагружаем все IFC файлы в фоновом режиме
    console.log('Preloading all user IFC files...');
    await auth.preloadAllUserIFCFiles(ifcLoader);
    console.log('All IFC files preloaded successfully');
    
    // Скрываем все загруженные файлы по умолчанию
    console.log('Hiding all preloaded files...');
    for (const [id, model] of fragments.list) {
      model.visible = false;
      if (world && world.scene.three.children.includes(model.object)) {
        world.scene.three.remove(model.object);
      }
    }
    console.log('All files are now hidden');
    
    // Если есть файл для загрузки из URL, показываем его
    if (window.fileToLoad) {
      console.log('Loading specific file from URL:', window.fileToLoad);
      const modelId = window.fileToLoad.replace(".ifc", "");
      auth.showModel(fragments, modelId, true, world);
      console.log(`File ${window.fileToLoad} is now visible`);
      window.fileToLoad = null; // Clear the file to load
    }
    
    // Update models list
    updateModelsList();
  } else {
    console.log('Not authenticated');
  }
}

function updateModelsList() {
  const modelsList = document.getElementById('models-list');
  if (!modelsList) return;

  modelsList.innerHTML = '';

  if (fragments.list.size === 0) {
    modelsList.innerHTML = '<div style="text-align: center; color: #ccc; padding: 20px;">No models loaded</div>';
    return;
  }

  for (const [id, model] of fragments.list) {
    const modelElement = document.createElement('div');
    modelElement.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      border: 1px solid #404040;
      margin-bottom: 4px;
      border-radius: 4px;
      background: #1a1d23;
    `;

    modelElement.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: bold; color: #fff; font-size: 14px;">${id}</div>
        <div style="font-size: 12px; color: #ccc;">${model.visible ? 'Visible' : 'Hidden'}</div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button
          onclick="toggleModel('${id}', ${model.visible})"
          style="
            background: ${model.visible ? '#dc3545' : '#28a745'};
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
          "
        >
          ${model.visible ? 'Hide' : 'Show'}
        </button>
      </div>
    `;

    modelsList.appendChild(modelElement);
  }
}

// Global function for toggling models
(window as any).toggleModel = (modelId: string, isVisible: boolean) => {
  const model = fragments.list.get(modelId);
  if (model) {
    model.visible = !isVisible;
    if (model.visible) {
      world.scene.three.add(model.object);
    } else {
      world.scene.three.remove(model.object);
    }
    updateModelsList();
  }
};

// Listen for messages from dashboard
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://localhost:8000') {
    return;
  }
  
  if (event.data.type === 'showFile') {
    const { filename } = event.data;
    console.log('Received showFile command from dashboard:', filename);
    
    // Show the specified file
    const modelId = filename.replace(".ifc", "");
    auth.showModel(fragments, modelId, true, world);
    
    console.log(`File ${filename} is now visible in background viewer`);
  }
});

// IoT Sensors functionality
import { getSensors, getSensorByElementId } from "./virtualSensors";

// Функция для обновления панели датчиков
function updateSensorPanel() {
  const list = document.getElementById("sensor-list");
  if (!list) return;
  const sensors = getSensors();
  list.innerHTML = sensors.map(
    s => `<li><strong>${s.name}:</strong> ${s.temperature}°C</li>`
  ).join("");
}

// Обновляем панель каждые 2 секунды
setInterval(updateSensorPanel, 2000);
updateSensorPanel(); // первый вызов сразу

// Initialize auth
initializeAuth();
