import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";
import { AuthIntegration } from "./auth-integration";

// Declare global variables
declare global {
  interface Window {
    fileToLoad: string | null;
  }
}

BUI.Manager.init();

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
// Expose world globally for integrations
;(window as any).world = world;
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

// Исправление ошибок WebGL
const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
  
  // Убедимся, что размеры viewport корректны
  const canvas = world.renderer.three.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  if (width > 0 && height > 0) {
    world.renderer.three.setSize(width, height, false);
  }
};

// Принудительно вызываем resize после загрузки
setTimeout(resizeWorld, 100);

viewport.addEventListener("resize", resizeWorld);

world.dynamicAnchor = false;

components.init();

components.get(OBC.Raycasters).get(world);

const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

// Disable WebGL warnings and initialize renderer properly
world.renderer.three.setSize(viewport.clientWidth, viewport.clientHeight);
world.renderer.three.shadowMap.enabled = true;
world.renderer.three.shadowMap.type = THREE.PCFSoftShadowMap;

// Initialize WebGL context properly
world.renderer.three.setPixelRatio(window.devicePixelRatio);
world.renderer.three.antialias = true;
world.renderer.three.alpha = false;

// Disable WebGL warnings by setting proper context attributes
const canvas = world.renderer.three.domElement;
const gl = canvas.getContext('webgl2', {
  antialias: true,
  alpha: false,
  depth: true,
  stencil: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance'
});

if (gl) {
  // Set proper WebGL state
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
}

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
fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");

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
console.log('Setting up IFC loader...');
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.70/" },
});
console.log('IFC loader setup completed');

// System check
console.log('=== SYSTEM CHECK ===');
console.log('WebGL supported:', !!window.WebGLRenderingContext);
console.log('Three.js version:', THREE.REVISION);
console.log('IfcLoader available:', !!ifcLoader);
console.log('Fragments manager:', !!fragments);

// Убираем ручную проверку WASM (ломается CORS); доверяем autoSetWasm

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
  if (!world.scene.three.children.includes(model.object)) {
  world.scene.three.add(model.object);
  }
  model.visible = false;
  await fragments.core.update(true);
});

// Viewport Layouts
const [viewportSettings] = BUI.Component.create(viewportSettingsTemplate, {
  components,
  world,
});

viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(TEMPLATES.viewportGridTemplate, {
  components,
  world,
});

viewport.append(viewportGrid);

// Content Grid Setup
const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create<
  BUI.Grid<TEMPLATES.ContentGridLayouts, TEMPLATES.ContentGridElements>,
  TEMPLATES.ContentGridState
>(TEMPLATES.contentGridTemplate, {
  components,
  id: CONTENT_GRID_ID,
  viewportTemplate: viewportCardTemplate,
});

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(
      1,
    ) as TEMPLATES.ContentGridLayouts[number];
    if (Object.keys(contentGrid.layouts).includes(hash)) {
      contentGrid.layout = hash;
    } else {
      contentGrid.layout = "Viewer";
      window.location.hash = "Viewer";
    }
  } else {
    window.location.hash = "Viewer";
    contentGrid.layout = "Viewer";
  }
};

setInitialLayout();

contentGrid.addEventListener("layoutchange", () => {
  window.location.hash = contentGrid.layout as string;
});

const contentGridIcons: Record<TEMPLATES.ContentGridLayouts[number], string> = {
  Viewer: appIcons.MODEL,
};

// App Grid Setup
type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = { name: "contentGrid"; state: TEMPLATES.ContentGridState };

type AppGridElements = [Sidebar, ContentGrid];

const app = document.getElementById("app") as BUI.Grid<
  AppLayouts,
  AppGridElements
>;

app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      compact: true,
      layoutIcons: contentGridIcons,
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar(),
);

app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";

// Auth Integration Setup
const auth = AuthIntegration.getInstance();

// Check for file parameter in URL
const urlParams = new URLSearchParams(window.location.search);
const fileFromUrl = urlParams.get('file');
const tokenFromUrl = urlParams.get('token');

// Read extra flags
const preloadFlag = urlParams.get('preload');

// If preload requested, start preloading early in background
if (preloadFlag === '1' || preloadFlag === 'true') {
  setTimeout(async () => {
    try {
      await auth.initializeModelPreloading(ifcLoader);
    } catch (e) {
      console.error('Background preload failed:', e);
    }
  }, 500);
}

// Clean token from URL if present; use message-based token passing
if (tokenFromUrl) {
  try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
}

// Handle messages from dashboard
window.addEventListener('message', async (event) => {
  if (event.origin !== 'http://localhost:8000') return;
  const data = event.data || {};
  if (data.type === 'token' && data.value) {
    auth.setToken(data.value, true);
  }
  if (data.type === 'manifest' && Array.isArray(data.value)) {
    try { localStorage.setItem('files_manifest', JSON.stringify(data.value)); } catch {}
  }
  if (data.type === 'preloadAll') {
    try { await auth.initializeModelPreloading(ifcLoader); } catch (e) { console.error(e); }
  }
  if (data.type === 'showFile' && data.filename) {
    const modelId = data.filename.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
    const modelManager = (window as any).ModelManager?.getInstance();
    if (modelManager) modelManager.showSingleModel(modelId, world);
  }
  if (data.type === 'focus') {
    try { window.focus(); } catch {}
  }
});

// On load, if dashboard asked to show a file (same-window nav), read and clear flag
try {
  const pendingFile = localStorage.getItem('viewer_show_file');
  if (pendingFile) {
    localStorage.removeItem('viewer_show_file');
    const modelId = pendingFile.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
    const modelManager = (window as any).ModelManager?.getInstance();
    setTimeout(() => modelManager?.showSingleModel(modelId, world), 500);
  }
} catch {}

// If file is specified in URL, load it immediately after auth initialization
if (fileFromUrl) {
  // Store the file to load after auth is initialized
  window.fileToLoad = fileFromUrl;
}

// Initialize auth and load user files
let isAuthenticated = false;
let userFiles: any[] = [];
let preloadedModels: Map<string, any> = new Map();

// Preload flags are preserved between sessions

// Model Manager with Singleton pattern for centralized model management
class ModelManager {
    private static instance: ModelManager;
    private preloadedModels: Map<string, any> = new Map();
    private isPreloaded = false;

    public static getInstance(): ModelManager {
        if (!ModelManager.instance) {
            ModelManager.instance = new ModelManager();
        }
        return ModelManager.instance;
    }

    public async preloadModelsOnce(ifcLoader: any, userFiles: any[]): Promise<void> {
        if (this.isPreloaded) {
            console.log('Models already preloaded, skipping...');
            postPreloadStatus('ready', 100);
            return;
        }

        console.log('Starting one-time model preloading...');
        postPreloadStatus('preloading', 0);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const ifcFiles = userFiles.filter((f) => f.is_ifc);
        const total = ifcFiles.length || 1;
        let count = 0;

        // Helper: wait until fragments model appears in list
        const waitForFragmentModel = async (id: string, timeoutMs = 5000) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            for (const [mid] of fragments.list) {
              if (mid === id) return true;
            }
            await new Promise(r => setTimeout(r, 50));
          }
          return false;
        };

        for (const file of ifcFiles) {
          try {
            const modelId = file.name.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
            if (this.preloadedModels.has(modelId)) {
              count++;
              postPreloadStatus('preloading', Math.round((count / total) * 100));
              continue;
            }

            console.log(`Preloading model: ${modelId}`);

            // Revert to original: load IFC via URL with token in query
            const token = localStorage.getItem('access_token');
            const fileUrl = `http://localhost:8000/api/files/download/${file.name}?token=${token}`;
            console.log(`Loading IFC from URL: ${fileUrl}`);
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}: ${response.status}`);
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const model = await ifcLoader.load(bytes, true, modelId);
            this.preloadedModels.set(modelId, { model, visible: false, fileInfo: file });
      model.visible = false;

            count++;
            postPreloadStatus('preloading', Math.round((count / total) * 100));
          } catch (error) {
            console.error(`Failed to preload ${file.name}:`, error);
          }
        }

        this.isPreloaded = true;
        localStorage.setItem('models_preloaded', 'true');
        postPreloadStatus('ready', 100);
        console.log(`Model preloading completed. Total models: ${this.preloadedModels.size}`);
    }

    public toggleModelVisibility(modelId: string, world: any): boolean {
        const modelData = this.preloadedModels.get(modelId);
        if (!modelData) {
            console.warn(`Model ${modelId} not found in preloaded models`);
            return false;
        }

        modelData.visible = !modelData.visible;
        modelData.model.visible = modelData.visible;

        // Используем стандартные методы That Open Platform для управления видимостью
        if (modelData.visible) {
            // Добавляем на сцену только при показе согласно документации
            if (!world.scene.three.children.includes(modelData.model.object)) {
                world.scene.three.add(modelData.model.object);
            }
            try { localStorage.setItem('viewer_last_model', modelId); } catch {}
            console.log(`Model ${modelId} shown on scene using That Open Platform`);
        } else {
            // Убираем со сцены при скрытии согласно документации
            if (world.scene.three.children.includes(modelData.model.object)) {
                world.scene.three.remove(modelData.model.object);
            }
            console.log(`Model ${modelId} hidden from scene using That Open Platform`);
        }

        console.log(`Model ${modelId} visibility: ${modelData.visible}`);
        return modelData.visible;
    }

    public showSingleModel(modelId: string, world: any): void {
        // Сначала скрываем все модели согласно стандартам That Open Platform
        this.hideAllModels(world);
        
        // Показываем только запрошенную модель
        const modelData = this.preloadedModels.get(modelId);
        if (modelData) {
            modelData.visible = true;
            modelData.model.visible = true;
            if (!world.scene.three.children.includes(modelData.model.object)) {
                world.scene.three.add(modelData.model.object);
            }
            console.log(`Showing single model: ${modelId} using That Open Platform`);
            try { localStorage.setItem('viewer_last_model', modelId); } catch {}
        }
    }

    public hideAllModels(world: any): void {
        // Скрываем все модели согласно стандартам That Open Platform
        for (const [id, modelData] of this.preloadedModels) {
            modelData.visible = false;
            modelData.model.visible = false;
            if (world.scene.three.children.includes(modelData.model.object)) {
                world.scene.three.remove(modelData.model.object);
            }
        }
        console.log('All models hidden from scene using That Open Platform');
    }

    public getModelList(): string[] {
        return Array.from(this.preloadedModels.keys());
    }

    public isModelsPreloaded(): boolean {
        return this.isPreloaded && this.preloadedModels.size > 0;
    }
}

// Делаем ModelManager доступным глобально
(window as any).ModelManager = ModelManager;

// Функция для обновления UI со списком моделей в стандартном шаблоне That Open
function updateModelsUI(modelList: string[]) {
  console.log('Updating models UI with:', modelList);
  
  // Используем стандартный UI шаблон That Open Platform
  // Находим существующую панель моделей/файлов
  const filesPanel = document.querySelector('bim-panel-section[label="Models"], [data-tool="files"]');
  if (!filesPanel) {
    console.warn('Files panel not found in That Open UI template');
    return;
  }
  
  // Находим тело панели файлов
  const filesPanelBody = (filesPanel as HTMLElement).querySelector('.bim-panel-body') || (filesPanel as HTMLElement).querySelector('bim-table, .bim-table');
  if (!filesPanelBody) {
    console.warn('Files panel body not found');
    return;
  }
  
  // Очищаем существующий контент
  filesPanelBody.innerHTML = '';
  
  // Создаем элементы для каждой модели используя стандартные компоненты That Open Platform
  modelList.forEach(modelId => {
                  const fileElement = document.createElement('div');
    fileElement.className = 'bim-file-item';
                  fileElement.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem;
      margin: 0.25rem 0;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0.25rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: background-color 0.2s ease;
    `;
    
    // Получаем информацию о файле из ModelManager
    const modelManager = ModelManager.getInstance();
    const modelData = modelManager.preloadedModels.get(modelId);
    const fileInfo = modelData?.fileInfo;
    const fileSize = fileInfo?.size ? `${(fileInfo.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size';

                  fileElement.innerHTML = `
                    <div style="flex: 1;">
        <div style="font-weight: bold; color: #fff; margin-bottom: 0.25rem;">${modelId}</div>
        <div style="font-size: 0.8em; color: #ccc;">IFC Model • ${fileSize}</div>
        <div style="font-size: 0.7em; color: #999; margin-top: 0.25rem;">That Open Platform</div>
                    </div>
                    <div style="display: flex; gap: 0.25rem;">
        <bim-button id="toggle-${modelId}" icon="mdi:eye-off" 
          style="background: #28a745; color: white; border: none; padding: 0.25rem; min-width: 32px; height: 32px; border-radius: 4px;" 
          title="Toggle visibility">
        </bim-button>
                    </div>
                  `;

    // Добавляем hover эффект
    fileElement.addEventListener('mouseenter', () => {
      fileElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    fileElement.addEventListener('mouseleave', () => {
      fileElement.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    });
    
    const toggleBtn = fileElement.querySelector(`#toggle-${modelId}`) as any;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const modelManager = ModelManager.getInstance();
        const isVisible = modelManager.toggleModelVisibility(modelId, world);
        toggleBtn.innerHTML = isVisible ? 
          '<bim-icon name="mdi:eye"></bim-icon>' : 
          '<bim-icon name="mdi:eye-off"></bim-icon>';
        toggleBtn.style.background = isVisible ? '#dc3545' : '#28a745';
      });
    }
    
    filesPanelBody.appendChild(fileElement);
  });
  
  console.log(`UI updated with ${modelList.length} models in standard That Open template`);
}

async function initializeAuth() {
  console.log('=== AUTH INITIALIZATION STARTED ===');
  
  try {
    console.log('Step 1: Checking auth...');
  isAuthenticated = await auth.checkAuth();
    console.log('Auth result:', isAuthenticated);
  } catch (error) {
    console.error('Error in auth.checkAuth():', error);
    isAuthenticated = false;
  }
  
  console.log('Auth check completed, proceeding with file loading...');
  
  // Skip authentication for now and try to load files directly
  console.log('Skipping authentication, trying to load files directly...');
  const filesAlreadyLoaded = localStorage.getItem('files_loaded');
  console.log('Files already loaded:', filesAlreadyLoaded);
  console.log('isAuthenticated:', isAuthenticated);
  
  if (!filesAlreadyLoaded) {
    // Load user files only once
    console.log('Step 2: Loading user files...');
    try {
    userFiles = await auth.loadUserFiles();
      console.log('User files loaded:', userFiles.length, userFiles);
    } catch (error) {
      console.error('Error loading user files:', error);
      return;
    }
    
    if (userFiles.length > 0) {
      console.log('Step 3: Preloading IFC files...');
      console.log('User files count:', userFiles.length);
      console.log('IFC files count:', userFiles.filter(f => f.is_ifc).length);
      
      try {
    await auth.preloadAllUserIFCFiles(ifcLoader);
        console.log('IFC preload completed');
        
        // Ждем немного, чтобы ifcLoader успел обработать файлы
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Добавить проверку fragments
        console.log('Fragments after preload:', fragments.list.size);
        fragments.list.forEach((model, id) => {
          console.log('Model in fragments:', id, model);
        });
        
        // Mark files as loaded
        localStorage.setItem('files_loaded', 'true');
        console.log('Files marked as loaded in localStorage');
      } catch (error) {
        console.error('Error during preloading:', error);
      }
    } else {
      console.log('No user files found to preload');
            }
  } else {
    console.log('Files already loaded, skipping preload');
    // Load user files list for UI
    userFiles = await auth.loadUserFiles();
    console.log('Loaded user files for UI:', userFiles);
  }
    
    // Сохраняем ссылки на предзагруженные модели
    console.log('Fragments list:', fragments.list);
    console.log('Fragments list size:', fragments.list.size);
    
    for (const [id, model] of fragments.list) {
      preloadedModels.set(id, model);
      console.log(`Added model ${id} to preloadedModels`);
    }
    
    // Force update the models list in UI
    console.log('Forcing models list update...');
    setTimeout(() => {
      // Trigger a custom event to update the models list
      const event = new CustomEvent('modelsUpdated', { 
        detail: { models: Array.from(fragments.list.keys()) } 
      });
      window.dispatchEvent(event);
      console.log('Models list update event dispatched');
    }, 500);
    
    // Removed automatic hiding calls after preload completion
    // (visibilities are controlled by UI and saved state)
    
    // Если есть файл для загрузки из URL, показываем его
    if (window.fileToLoad) {
      console.log('Loading specific file from URL:', window.fileToLoad);
      const modelId = window.fileToLoad.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
      const fileUrl = `http://localhost:8000/api/files/download/${window.fileToLoad}?token=${localStorage.getItem('access_token')}`;
      
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}`);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const model = await ifcLoader.load(bytes, true, modelId);
        
        // Add to scene and show
        world.scene.three.add(model.object);
        model.visible = true;
        console.log(`File ${window.fileToLoad} loaded and shown in scene`);
      } catch (error) {
        console.error('Failed to load file from URL:', error);
      }
      window.fileToLoad = null;
    }
    
    // Files are now available in the original BUI models list
}

// Функция для показа модели в сцене
function showModelInScene(modelId: string) {
  const model = preloadedModels.get(modelId);
  if (model) {
    model.visible = true;
    if (!world.scene.three.children.includes(model.object)) {
      world.scene.three.add(model.object);
    }
    console.log(`Model ${modelId} is now visible in scene`);
  }
}

// Функция для скрытия модели из сцены
function hideModelFromScene(modelId: string) {
  const model = preloadedModels.get(modelId);
  if (model) {
    model.visible = false;
    if (world.scene.three.children.includes(model.object)) {
      world.scene.three.remove(model.object);
    }
    console.log(`Model ${modelId} is now hidden from scene`);
  }
}

// Функция для удаления модели из карточки (но не из хранилища)
function removeModelFromCard(modelId: string) {
  const model = preloadedModels.get(modelId);
  if (model) {
    // Удаляем из fragments но не из хранилища
    fragments.list.delete(modelId);
    preloadedModels.delete(modelId);
    console.log(`Model ${modelId} removed from card but kept in storage`);
  }
}

// Test API connection first
console.log('Testing API connection...');
const apiTestPromise = fetch('http://localhost:8000/users/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzU4Nzk2ODExfQ.kyb9xGTkH42MnxfFSSLC_9BvvB5Op9VoOfOifd-Tfbk',
    'Content-Type': 'application/json'
  }
}).then(response => {
  console.log('API test response status:', response.status);
  return response.json();
}).then(data => {
  console.log('API test response data:', data);
}).catch(error => {
  console.error('API test failed:', error);
});

// Test files API
console.log('Testing files API...');
const filesTestPromise = fetch('http://localhost:8000/api/files', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzU4Nzk2ODExfQ.kyb9xGTkH42MnxfFSSLC_9BvvB5Op9VoOfOifd-Tfbk',
    'Content-Type': 'application/json'
  }
}).then(response => {
  console.log('Files API test response status:', response.status);
  return response.json();
}).then(data => {
  console.log('Files API test response data:', data);
}).catch(error => {
  console.error('Files API test failed:', error);
});

// Add timeout to API tests
setTimeout(() => {
  console.log('API tests timeout - checking if they completed...');
}, 5000);

// Simple test to check if fetch works at all
console.log('Testing basic fetch...');
fetch('http://localhost:8000/')
  .then(response => {
    console.log('Basic fetch response status:', response.status);
    return response.text();
  })
  .then(text => {
    console.log('Basic fetch response text length:', text.length);
  })
  .catch(error => {
    console.error('Basic fetch failed:', error);
  });

// Test with timeout
console.log('Testing fetch with timeout...');
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 3000)
);

Promise.race([
  fetch('http://localhost:8000/users/me', {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzU4Nzk2ODExfQ.kyb9xGTkH42MnxfFSSLC_9BvvB5Op9VoOfOifd-Tfbk'
    }
  }),
  timeoutPromise
])
.then(response => {
  console.log('Timeout test response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Timeout test response data:', data);
})
.catch(error => {
  console.error('Timeout test failed:', error);
});

// Убрать немедленную инициализацию и оставить только отложенную
console.log('Starting auth initialization in 2 seconds...');

// Альтернативный подход - немедленная инициализация для тестирования
console.log('Also trying immediate initialization...');
setTimeout(async () => {
  console.log('=== IMMEDIATE INITIALIZATION TEST ===');
  console.log('⏰ Immediate timeout executed at:', new Date().toISOString());
  
  try {
    console.log('🔍 Testing basic auth check...');
    const testResult = await auth.checkAuth();
    console.log('✅ Immediate auth test result:', testResult);
  } catch (error) {
    console.error('❌ Immediate auth test failed:', error);
  }
}, 500);

// Дополнительный тест - простой fetch без авторизации
setTimeout(async () => {
  console.log('=== TESTING BASIC CONNECTIVITY ===');
  try {
    const response = await fetch('http://localhost:8000/', { 
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    console.log('Basic connectivity test:', response.status, response.statusText);
  } catch (error) {
    console.error('Basic connectivity test failed:', error);
  }
}, 1000);

setTimeout(async () => {
  console.log('=== AUTH INITIALIZATION STARTED ===');
  console.log('⏰ Timeout callback executed at:', new Date().toISOString());
  console.log('🔍 Auth object available:', !!auth);
  console.log('🔍 IFC Loader available:', !!ifcLoader);
  console.log('🔍 World available:', !!world);
  
  try {
    console.log('Step 1: Checking auth...');
    console.log('📞 Calling auth.checkAuth()...');
    const isAuthenticated = await auth.checkAuth();
    console.log('✅ Auth result:', isAuthenticated);
    
    if (!isAuthenticated) {
      console.log('Auth failed, trying fallback approach...');
      
      // Временный обходной путь - попробуем загрузить тестовые файлы
      console.log('Attempting to load test files without authentication...');
      try {
        const testFiles = [
          { name: 'Test_Building_01.ifc', size: 1024000, url: 'http://localhost:8000/api/files/download/Test_Building_01.ifc', is_ifc: true }
        ];
        
        const modelManager = ModelManager.getInstance();
        await modelManager.preloadModelsOnce(ifcLoader, testFiles);
        modelManager.hideAllModels(world);
        
        console.log('Test files loaded successfully');
        updateModelsUI(modelManager.getModelList());
      } catch (fallbackError) {
        console.error('Fallback approach also failed:', fallbackError);
      }
    return;
  }
  
    console.log('Step 2: Loading user files...');
    const userFiles = await auth.loadUserFiles();
    console.log('User files loaded:', userFiles.length);
    console.log('User files details:', userFiles);
    
    if (userFiles.length > 0) {
      console.log('Step 3: Initializing model preloading...');
      // Start background preload once per browser
      try {
        await auth.initializeModelPreloading(ifcLoader);
        console.log('Model preloading completed successfully');
      } catch (preloadError) {
        console.error('Model preloading failed:', preloadError);
      }
    }
    
  } catch (error) {
    console.error('Auth initialization failed:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
  }
}, 2000);

// Временно: пропустить auth и загрузить тестовый IFC файл
async function loadTestIFC() {
  console.log('Loading test IFC file...');
  
  try {
    // Используем mock данные для тестирования
    const mockFiles = [
      {
        name: 'Test_Building_01.ifc',
        is_ifc: true,
        mock_url: '/api/mock/files/Test_Building_01.ifc'
      }
    ];
    
    console.log('Mock files:', mockFiles);
    
    // Загружаем первый IFC файл
    const file = mockFiles[0];
    console.log('Loading mock IFC file:', file.name);
    
    // Создаем простую геометрию для тестирования
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, 0);
    
    // Добавляем в сцену
    world.scene.three.add(cube);
    console.log('Test geometry added to scene');
    
  } catch (error) {
    console.error('Test IFC loading failed:', error);
  }
}

// Вызвать после инициализации ifcLoader
setTimeout(loadTestIFC, 5000);

// Простой тест auth без setTimeout
console.log('=== SYNCHRONOUS AUTH TEST ===');
console.log('🔍 Auth object:', auth);
console.log('🔍 Auth methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(auth)));

// Попробуем вызвать checkAuth синхронно для тестирования
(async () => {
  console.log('🧪 Testing auth.checkAuth() synchronously...');
  try {
    const result = await auth.checkAuth();
    console.log('✅ Synchronous auth result:', result);
  } catch (error) {
    console.error('❌ Synchronous auth error:', error);
  }
})();

// Обработчик сообщений от дашборда
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://localhost:8000') return;
  if (event.data.type === 'viewFile') {
    const { filename } = event.data;
    const modelId = filename.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
    const modelManager = ModelManager.getInstance();
    modelManager.showSingleModel(modelId, world);
    console.log(`Showing file from dashboard: ${filename}`);
  }
});

// Проверка URL параметров для показа конкретного файла
if (window.fileToLoad) {
  const modelId = window.fileToLoad.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
  console.log(`URL parameter: show file ${modelId}`);
  setTimeout(() => {
    const modelManager = ModelManager.getInstance();
    modelManager.showSingleModel(modelId, world);
  }, 3000); // Ждем загрузки моделей
}

// Removed custom card update logic - using original BUI components

// Dashboard button functionality
const dashboardButton = document.getElementById('back-to-dashboard');
if (dashboardButton) {
  dashboardButton.addEventListener('click', () => {
    window.location.href = 'http://localhost:8000/dashboard';
  });
}

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

// Listen for messages from dashboard
window.addEventListener('message', async (event) => {
  if (event.origin !== 'http://localhost:8000') {
    return;
  }
  
  if (event.data.type === 'showFile') {
    const { filename } = event.data;
    const modelId = filename.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
    console.log('Received showFile command from dashboard:', filename);

    try {
      const modelManager = (window as any).ModelManager?.getInstance();
      // Ensure models are preloaded before showing
      if (localStorage.getItem('files_loaded') !== 'true') {
        console.log('Files not flagged as loaded; initializing preloading');
        await auth.initializeModelPreloading(ifcLoader);
      }

      if (modelManager) {
        // Show only requested model (simulating UI toggle)
        modelManager.showSingleModel(modelId, world);
      } else {
        // Fallback: iterate fragments and show
        for (const [id, model] of fragments.list) {
          model.visible = (id === modelId);
          if (model.visible) {
            if (!world.scene.three.children.includes(model.object)) {
              world.scene.three.add(model.object);
            }
          } else if (world.scene.three.children.includes(model.object)) {
            world.scene.three.remove(model.object);
          }
        }
      }
    } catch (e) {
      console.error('Failed handling showFile message:', e);
    }
  }
  
  if (event.data.type === 'hideFile') {
    const { filename } = event.data;
    console.log('Received hideFile command from dashboard:', filename);
    
    // Hide the specified file from scene
    const modelId = filename.replace('.ifc', '');
    hideModelFromScene(modelId);
  }
  
  if (event.data.type === 'removeFile') {
    const { filename } = event.data;
    console.log('Received removeFile command from dashboard:', filename);
    
    // Remove file from card but keep in storage
    const modelId = filename.replace('.ifc', '');
    removeModelFromCard(modelId);
  }
});

// Helper to get host window (dashboard) for messaging
function getHostWindow(): Window | null {
  // If opened as popup, opener exists; if embedded as iframe, parent exists
  return (window.opener as Window | null) || (window.parent as Window | null) || null;
}

// Notify dashboard about preload status (non-sensitive)
function postPreloadStatus(state: 'idle' | 'preloading' | 'ready', progress?: number) {
  try { (window.opener as any)?.postMessage({ type: 'preload-status', state, progress }, '*'); } catch {}
  try { (window.parent as any)?.postMessage({ type: 'preload-status', state, progress }, '*'); } catch {}
}

window.addEventListener('message', async (event) => {
  if (event.origin.startsWith('http://localhost:')) {
    // still accept if same host group
  }
  const data = event.data || {};
  if (data.type === 'preload-status-request') {
    const done = localStorage.getItem('files_loaded') === 'true';
    postPreloadStatus(done ? 'ready' : 'idle', done ? 100 : 0);
  }
});

console.log('IFC loader setup completed');

// UI state persistence helpers
function saveCameraState() {
  try {
    const pos = world.camera.three.position;
    const tgt = world.camera.controls.getTarget(new THREE.Vector3());
    const state = { px: pos.x, py: pos.y, pz: pos.z, tx: tgt.x, ty: tgt.y, tz: tgt.z };
    localStorage.setItem('viewer_camera', JSON.stringify(state));
  } catch {}
}

function loadCameraState() {
  try {
    const raw = localStorage.getItem('viewer_camera');
    if (!raw) return;
    const s = JSON.parse(raw);
    world.camera.three.position.set(s.px, s.py, s.pz);
    world.camera.controls.setLookAt(s.px, s.py, s.pz, s.tx, s.ty, s.tz, false);
  } catch {}
}

function saveVisibleModels(modelManager: any) {
  try {
    const visible = Array.from(modelManager.getModelList()).filter((id: string) => {
      const m = (modelManager as any).preloadedModels.get(id);
      return m?.visible === true;
    });
    localStorage.setItem('viewer_visible_models', JSON.stringify(visible));
  } catch {}
}

function loadVisibleModels(modelManager: any) {
  try {
    const raw = localStorage.getItem('viewer_visible_models');
    if (!raw) return;
    const visible: string[] = JSON.parse(raw);
    if (!visible || visible.length === 0) return; // do not hide all when no state
    modelManager.hideAllModels(world);
    visible.forEach((id) => modelManager.toggleModelVisibility(id, world));
  } catch {}
}

// Persist camera on rest
world.camera.controls.addEventListener('rest', () => {
  saveCameraState();
});

// Restore camera early
loadCameraState();

// After preload/rehydrate finishes, restore visible models
(function hookAfterPreloadRestore() {
  const orig = (window as any).ModelManager?.getInstance?.().preloadModelsOnce;
  if (!orig) return;
  const mm = (window as any).ModelManager.getInstance();
  mm.preloadModelsOnce = async function(ifcLoader: any, userFiles: any[]) {
    await orig.apply(mm, [ifcLoader, userFiles]);
    loadVisibleModels(mm);
    try {
      const last = localStorage.getItem('viewer_last_model');
      if (last) {
        setTimeout(() => mm.showSingleModel(last, world), 200);
      }
    } catch {}
  };
})();