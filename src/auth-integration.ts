/**
 * Auth Integration Module for TSP IFC Viewer
 * Минимальное вмешательство в существующий код вьюера
 */

import { getIFCFromCache, putIFCToCache } from './cache';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  is_admin: boolean;
}

export interface AuthFile {
  name: string;
  size: number;
  url: string;
  is_ifc: boolean;
}

export class AuthIntegration {
  private static instance: AuthIntegration;
  private authUser: AuthUser | null = null;
  private authFiles: AuthFile[] = [];
  private authToken: string | null = null;
  private authBaseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.authBaseUrl = baseUrl;
    this.authToken = localStorage.getItem('access_token');
    console.log('AuthIntegration initialized with token:', this.authToken ? 'present' : 'missing');
  }

  static getInstance(baseUrl?: string): AuthIntegration {
    if (!AuthIntegration.instance) {
      AuthIntegration.instance = new AuthIntegration(baseUrl);
    }
    return AuthIntegration.instance;
  }

  /**
   * Обновить токен из localStorage
   */
  updateToken(): void {
    this.authToken = localStorage.getItem('access_token');
    console.log('Token updated:', this.authToken ? 'present' : 'missing');
  }

  /**
   * Установить токен программно (через postMessage из дашборда)
   */
  setToken(token: string, persist: boolean = true): void {
    this.authToken = token;
    if (persist) {
      try { localStorage.setItem('access_token', token); } catch {}
    }
    console.log('Auth token set via message:', this.authToken ? 'present' : 'missing');
  }

  /**
   * Проверка аутентификации
   */
  async checkAuth(): Promise<boolean> {
    console.log('🔐 checkAuth() called at:', new Date().toISOString());
    
    if (!this.authToken) {
      console.log('❌ No auth token available');
      return false;
    }

    console.log('=== CHECKING AUTHENTICATION ===');
    console.log('✅ Token present:', !!this.authToken);
    console.log('🔑 Token preview:', this.authToken.substring(0, 20) + '...');
    console.log('🌐 Making request to:', `${this.authBaseUrl}/users/me`);
    console.log('⏰ Starting auth check at:', new Date().toISOString());

    try {
      // Добавляем таймаут 10 секунд
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout - aborting...');
        controller.abort();
      }, 10000);

      console.log('🚀 Starting fetch request...');
      console.log('⏰ Request timeout set to 10 seconds');
      console.log('🔄 About to call fetch() at:', new Date().toISOString());
      const startTime = Date.now();
      
      console.log('📡 Calling fetch now...');
      const response = await fetch(`${this.authBaseUrl}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });

      const endTime = Date.now();
      clearTimeout(timeoutId);
      console.log('✅ Request completed successfully in', endTime - startTime, 'ms');
      console.log('📊 Auth check response status:', response.status);
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('Auth check failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        this.clearAuth();
        return false;
      }

      const userData = await response.json();
      console.log('User data received:', userData);
      this.authUser = userData;
      return true;

    } catch (error) {
      console.error('Error during auth check:', error);
      if (error.name === 'AbortError') {
        console.error('Request timed out - backend not responding');
      }
      this.clearAuth();
      return false;
    }
  }

  /**
   * Получение файлов пользователя
   */
  async loadUserFiles(): Promise<AuthFile[]> {
    console.log('=== LOADING USER FILES ===');
    
    if (!this.authToken) {
      console.log('No auth token available for loading files');
      return [];
    }

    console.log('Loading user files with token:', this.authToken.substring(0, 20) + '...');
    console.log('Making request to:', `${this.authBaseUrl}/api/files`);

    try {
      console.log('Starting files API request...');
      console.log('Files API URL:', `${this.authBaseUrl}/api/files`);
      console.log('Files API headers:', {
        'Authorization': `Bearer ${this.authToken.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });
      
      console.log('Making fetch request to files API...');
      const response = await fetch(`${this.authBaseUrl}/api/files`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Files API fetch completed');

      if (response.status === 401) {
        this.handleUnauthorized();
        return [];
      }

      console.log('Files API response status:', response.status);
      console.log('Files API response headers:', response.headers);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Raw API response:', responseData);

        // Handle API response wrapper
        const files = responseData.data || responseData;
        console.log('Files from API:', files);

        this.authFiles = files.map((file: any) => {
          const fileName = file.name || file.filename || file.original_name;
          const isIfc = fileName && (
            fileName.toLowerCase().endsWith('.ifc') ||
            fileName.toLowerCase().endsWith('.ifcxml') ||
            fileName.toLowerCase().endsWith('.ifczip')
          );
          return {
            name: fileName,
            size: file.size || file.file_size,
            url: `${this.authBaseUrl}/api/files/download/${fileName}`,
            is_ifc: isIfc
          };
        });
        return this.authFiles;
      } else {
        const errorText = await response.text();
        console.error('API request failed:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error('Failed to load user files:', error);
    }

    return [];
  }

  /**
   * Предзагрузка всех IFC файлов пользователя в фоновом режиме
   * Файлы загружаются через IfcLoader, но не отображаются в сцене
   */
  async preloadAllUserIFCFiles(ifcLoader: any): Promise<void> {
    console.log('=== PRELOADING IFC FILES ===');
    
    if (!this.authToken) {
      console.error('No auth token available');
      return;
    }

    try {
      const manifest = JSON.parse(localStorage.getItem('files_manifest') || '[]');
      const manifestMap = new Map<string, any>(manifest.map((m: any) => [m.name, m]));
      const ifcFiles = (this.authFiles || []).filter(file => file.is_ifc);
      const filesAlreadyLoaded = localStorage.getItem('files_loaded') === 'true';

      // Rehydrate path (no network)
      if (filesAlreadyLoaded) {
        console.log('files_loaded=true -> rehydrate from IndexedDB cache');
        for (const file of ifcFiles) {
          try {
            const m = manifestMap.get(file.name);
            const etag = m?.etag || null;
            const bytes = await getIFCFromCache(file.name, file.size, etag);
            if (!bytes) { console.warn(`Cache miss for ${file.name}`); continue; }
            const modelName = file.name.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
            await ifcLoader.load(bytes, true, modelName);
          } catch (e) {
            console.error('Rehydrate error:', e);
          }
        }
        return;
      }

      // Fresh preload (with cache fill)
      for (const file of ifcFiles) {
        try {
          const m = manifestMap.get(file.name);
          const etag = m?.etag || null;
          let bytes = await getIFCFromCache(file.name, file.size, etag);
          if (!bytes) {
            const downloadUrl = `${this.authBaseUrl}/api/files/download/${file.name}?token=${this.authToken}`;
            const response = await fetch(downloadUrl, { headers: { 'Content-Type': 'application/octet-stream' } });
            if (!response.ok) { console.warn(`Failed to preload ${file.name}: ${response.status}`); continue; }
            const arrayBuffer = await response.arrayBuffer();
            bytes = new Uint8Array(arrayBuffer);
            await putIFCToCache(file.name, file.size, etag, bytes);
          }
          const modelName = file.name.replace(/\.(ifc|ifcxml|ifczip)$/i, "");
          const model = await ifcLoader.load(bytes, true, modelName);
          // Не трогаем видимость здесь; управление видимостью через ModelManager/UI
          // model.visible = false; // удалено чтобы не перезаписывать сразу видимость
        } catch (error) {
          console.error(`Error preloading ${file.name}:`, error);
        }
      }

      localStorage.setItem('files_loaded', 'true');
      console.log('All user IFC files preloaded and files_loaded=true');
    } catch (error) {
      console.error('Failed to preload user IFC files:', error);
    }
  }


  /**
   * Получить список всех загруженных моделей
   */
  getLoadedModels(fragments: any): string[] {
    const models: string[] = [];
    for (const [id, model] of fragments.list) {
      models.push(id);
    }
    return models;
  }

  /**
   * Показать/скрыть конкретную модель в сцене
   */
  showModel(fragments: any, modelId: string, visible: boolean = true, world?: any): void {
    try {
      // Находим модель по ID в fragments.list
      for (const [id, model] of fragments.list) {
        if (id === modelId) {
          if (visible) {
            // Показываем модель
            model.visible = true;
            // Добавляем в сцену если нужно
            if (world && !world.scene.three.children.includes(model.object)) {
              world.scene.three.add(model.object);
            }
          } else {
            // Скрываем модель
            model.visible = false;
            // Убираем из сцены
            if (world && world.scene.three.children.includes(model.object)) {
              world.scene.three.remove(model.object);
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error showing/hiding model ${modelId}:`, error);
    }
  }

  /**
   * Скрыть все модели кроме указанной
   */
  showOnlyModel(fragments: any, modelId: string, world?: any): void {
    try {
      // Сначала скрываем все модели
      for (const [id, model] of fragments.list) {
        if (id !== modelId) {
          model.visible = false;
          if (world && world.scene.three.children.includes(model.object)) {
            world.scene.three.remove(model.object);
          }
        }
      }
      // Показываем только нужную модель
      this.showModel(fragments, modelId, true, world);
    } catch (error) {
      console.error(`Error showing only model ${modelId}:`, error);
    }
  }

  /**
   * Загрузка IFC файла для просмотра
   */
  async loadIFCFile(filename: string): Promise<ArrayBuffer | null> {
    if (!this.authToken) {
      console.error('No auth token available');
      return null;
    }

    try {
      console.log(`Loading IFC file: ${filename} with token: ${this.authToken?.substring(0, 20)}...`);
      
      const response = await fetch(`${this.authBaseUrl}/api/files/download/${filename}?token=${this.authToken}`);

      console.log(`Response status: ${response.status}`);
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log(`IFC file ${filename} loaded successfully, size: ${arrayBuffer.byteLength} bytes`);
        return arrayBuffer;
      } else {
        const errorText = await response.text();
        console.error(`Failed to load IFC file: ${response.status} ${response.statusText}`, errorText);
      }
    } catch (error) {
      console.error('Failed to load IFC file:', error);
    }

    return null;
  }

  /**
   * Перенаправление на загрузку файлов
   */
  redirectToFileUpload(): void {
    window.open(`${this.authBaseUrl}/files`, '_blank');
  }

  /**
   * Перенаправление в ЛК
   */
  redirectToDashboard(): void {
    window.open(`${this.authBaseUrl}/dashboard`, '_blank');
  }

  /**
   * Выход из системы
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.authBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      this.clearAuth();
      window.location.href = `${this.authBaseUrl}/login`;
    }
  }

  private handleUnauthorized() {
    console.warn('401 Unauthorized detected in viewer; broadcasting logout');
    try {
      const host = (window.opener as Window | null) || (window.parent as Window | null) || null;
      host?.postMessage({ type: 'logout' }, this.authBaseUrl);
    } catch {}
    this.clearAuth();
    window.location.href = `${this.authBaseUrl}/login`;
  }

  /**
   * Очистка данных аутентификации
   */
  private clearAuth(): void {
    this.authUser = null;
    this.authFiles = [];
    this.authToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('files_loaded');
    console.log('Auth cleared, files_loaded flag removed');
  }

  /**
   * Получение списка файлов
   */
  getFiles(): AuthFile[] {
    return this.authFiles;
  }

  /**
   * Проверка, аутентифицирован ли пользователь
   */
  isAuthenticated(): boolean {
    return this.authUser !== null;
  }

  /**
   * Инициализация предзагрузки моделей
   * Вызывается один раз после успешного логина
   */
  async initializeModelPreloading(ifcLoader: any): Promise<void> {
    // Проверяем не только флаг, но и реальное состояние ModelManager
    const modelManager = window.ModelManager?.getInstance();
    if (modelManager && modelManager.isModelsPreloaded()) {
      console.log('Models already preloaded in this session');
      return;
    }
    
    // Очищаем старый флаг если модели не загружены
    if (localStorage.getItem('models_preloaded') === 'true' && (!modelManager || modelManager.getModelList().length === 0)) {
      console.log('Clearing stale preload flag');
      localStorage.removeItem('models_preloaded');
    }

    try {
      const userFiles = await this.loadUserFiles();
      console.log('=== INITIALIZING MODEL PRELOADING ===');
      console.log('User files for preloading:', userFiles.length);
      
      // Используем глобальный ModelManager вместо импорта
      if (window.ModelManager) {
        const modelManager = window.ModelManager.getInstance();
        await modelManager.preloadModelsOnce(ifcLoader, userFiles);
        
        // Do not hide all models automatically; visibility is controlled by UI/state
        
        console.log('Model preloading initialization completed');
      } else {
        console.error('ModelManager not available on window object');
      }
    } catch (error) {
      console.error('Model preloading failed:', error);
    }
  }
}
