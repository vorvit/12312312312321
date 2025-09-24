/**
 * Auth Integration Module for TSP IFC Viewer
 * Минимальное вмешательство в существующий код вьюера
 */

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
  }

  static getInstance(baseUrl?: string): AuthIntegration {
    if (!AuthIntegration.instance) {
      AuthIntegration.instance = new AuthIntegration(baseUrl);
    }
    return AuthIntegration.instance;
  }

  /**
   * Проверка аутентификации
   */
  async checkAuth(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        this.authUser = await response.json();
        return true;
      } else {
        this.clearAuth();
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.clearAuth();
      return false;
    }
  }

  /**
   * Получение файлов пользователя
   */
  async loadUserFiles(): Promise<AuthFile[]> {
    if (!this.authToken) {
      return [];
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/api/files`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const files = await response.json();
        this.authFiles = files.map((file: any) => ({
          name: file.name,
          size: file.size,
          url: `${this.authBaseUrl}/files/download/${file.name}`,
          is_ifc: file.name.toLowerCase().endsWith('.ifc') || 
                  file.name.toLowerCase().endsWith('.ifcxml') || 
                  file.name.toLowerCase().endsWith('.ifczip')
        }));
        return this.authFiles;
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
    if (!this.authToken) {
      console.error('No auth token available');
      return;
    }

    try {
      console.log('Preloading all user IFC files...');
      
      for (const file of this.authFiles) {
        if (file.is_ifc) {
          try {
            console.log(`Preloading IFC file: ${file.name}`);
            
            const response = await fetch(`${this.authBaseUrl}/api/files/download/${file.name}?token=${this.authToken}`);

            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              
              // Загружаем файл через IfcLoader с visible: false
              await ifcLoader.load(bytes, false, file.name.replace(".ifc", ""));
              
              console.log(`IFC file ${file.name} preloaded successfully`);
            } else {
              console.warn(`Failed to preload ${file.name}: ${response.status}`);
            }
          } catch (error) {
            console.error(`Error preloading ${file.name}:`, error);
          }
        }
      }
      
      console.log('All user IFC files preloaded');
    } catch (error) {
      console.error('Failed to preload user IFC files:', error);
    }
  }

  /**
   * Показать конкретную модель в сцене
   */
  showModel(fragments: any, modelId: string): void {
    try {
      // Сначала скрываем все модели
      for (const [id, model] of fragments.list) {
        model.visible = false;
      }
      
      // Показываем только нужную модель
      for (const [id, model] of fragments.list) {
        if (id === modelId) {
          model.visible = true;
          break;
        }
      }
      
      console.log(`Model ${modelId} is now visible`);
    } catch (error) {
      console.error(`Error showing model ${modelId}:`, error);
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
   * Загрузка IFC файла для просмотра
   */
  async loadIFCFile(filename: string): Promise<ArrayBuffer | null> {
    if (!this.authToken) {
      console.error('No auth token available');
      return null;
    }

    try {
      console.log(`Loading IFC file: ${filename} with token: ${this.authToken.substring(0, 20)}...`);
      
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

  /**
   * Очистка данных аутентификации
   */
  private clearAuth(): void {
    this.authUser = null;
    this.authFiles = [];
    this.authToken = null;
    localStorage.removeItem('access_token');
  }

  /**
   * Получение информации о пользователе
   */
  getUser(): AuthUser | null {
    return this.authUser;
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
   * Показать/скрыть конкретную модель в сцене
   */
  showModel(fragments: any, modelId: string, visible: boolean = true): void {
    try {
      // Находим модель по ID в fragments.list
      for (const [id, model] of fragments.list) {
        if (id === modelId) {
          if (visible) {
            // Показываем модель
            model.visible = true;
            // Добавляем в сцену если нужно
            if (!world.scene.three.children.includes(model.object)) {
              world.scene.three.add(model.object);
            }
          } else {
            // Скрываем модель
            model.visible = false;
            // Убираем из сцены
            if (world.scene.three.children.includes(model.object)) {
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
  showOnlyModel(fragments: any, modelId: string): void {
    try {
      // Сначала скрываем все модели
      for (const [id, model] of fragments.list) {
        if (id !== modelId) {
          model.visible = false;
          if (world.scene.three.children.includes(model.object)) {
            world.scene.three.remove(model.object);
          }
        }
      }
      
      // Показываем только нужную модель
      this.showModel(fragments, modelId, true);
    } catch (error) {
      console.error(`Error showing only model ${modelId}:`, error);
    }
  }
}
