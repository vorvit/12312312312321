import * as BUI from "@thatopen/ui";
import { AuthIntegration, AuthFile } from "../../auth-integration";

export interface FileBrowserState {
  files: AuthFile[];
  selectedFile: string | null;
  searchTerm: string;
  isLoading: boolean;
  visibleFiles: string[]; // Track which files are visible
}

export const fileBrowserTemplate: BUI.StatefullComponent<FileBrowserState> = (
  state,
  update,
) => {
  const { files, selectedFile, searchTerm, isLoading, visibleFiles } = state;
  const auth = AuthIntegration.getInstance();

  const onFileSelect = (filename: string) => {
    update({ selectedFile: filename });
    // Emit custom event for file selection
    window.dispatchEvent(new CustomEvent('ifc-file-selected', { 
      detail: { filename, url: files.find(f => f.name === filename)?.url } 
    }));
  };

  const onSearchChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    update({ searchTerm: target.value });
  };

  const onLoadFiles = async () => {
    update({ isLoading: true });
    try {
      const userFiles = await auth.loadUserFiles();
      update({ files: userFiles, isLoading: false });
    } catch (error) {
      console.error('Failed to load files:', error);
      update({ isLoading: false });
    }
  };

  const onUploadRedirect = () => {
    auth.redirectToFileUpload();
  };

  const onToggleVisibility = (filename: string) => {
    const newVisibleFiles = [...visibleFiles];
    const index = newVisibleFiles.indexOf(filename);
    if (index > -1) {
      newVisibleFiles.splice(index, 1);
      // Hide file
      window.dispatchEvent(new CustomEvent('ifc-file-hide', { 
        detail: { filename } 
      }));
    } else {
      newVisibleFiles.push(filename);
      // Show file
      window.dispatchEvent(new CustomEvent('ifc-file-show', { 
        detail: { filename } 
      }));
    }
    update({ visibleFiles: newVisibleFiles });
  };

  const onRemoveFromCard = (filename: string) => {
    // Remove from card only, not from database
    const newFiles = files.filter(f => f.name !== filename);
    const newVisibleFiles = visibleFiles.filter(f => f !== filename);
    
    // Hide file if it was visible
    window.dispatchEvent(new CustomEvent('ifc-file-hide', { 
      detail: { filename } 
    }));
    
    update({ 
      files: newFiles, 
      visibleFiles: newVisibleFiles,
      selectedFile: selectedFile === filename ? null : selectedFile
    });
  };

  // Filter files based on search term
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) && file.is_ifc
  );

  return BUI.html`
    <div style="
      display: flex; 
      flex-direction: column; 
      height: 100%; 
      background: #1a1d23; 
      border-right: 1px solid #404040;
    ">
      <!-- Header -->
      <div style="padding: 1rem; border-bottom: 1px solid #404040;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="margin: 0; color: #fff; font-size: 16px;">IFC Files</h3>
          <bim-button 
            icon="mdi:refresh" 
            @click=${onLoadFiles}
            ?disabled=${isLoading}
            style="background: transparent; border: 1px solid #404040;"
          ></bim-button>
        </div>
        
        <!-- Search -->
        <div style="position: relative;">
          <input 
            type="text" 
            placeholder="Search files..." 
            value=${searchTerm}
            @input=${onSearchChange}
            style="
              width: 100%; 
              padding: 0.5rem 0.5rem 0.5rem 2rem; 
              background: #2a2d32; 
              border: 1px solid #404040; 
              border-radius: 4px; 
              color: #fff; 
              font-size: 14px;
            "
          />
          <bim-icon 
            icon="mdi:magnify" 
            style="
              position: absolute; 
              left: 0.5rem; 
              top: 50%; 
              transform: translateY(-50%); 
              color: #666;
            "
          ></bim-icon>
        </div>
      </div>

      <!-- File List -->
      <div style="flex: 1; overflow-y: auto; padding: 0.5rem;">
        ${isLoading ? BUI.html`
          <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
            <div style="color: #666;">Loading files...</div>
          </div>
        ` : filteredFiles.length === 0 ? BUI.html`
          <div style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 200px; 
            color: #666; 
            text-align: center;
          ">
            <bim-icon icon="mdi:folder-open" style="font-size: 48px; margin-bottom: 1rem; color: #444;"></bim-icon>
            <div style="margin-bottom: 1rem;">No IFC files found</div>
            <bim-button 
              label="Upload Files" 
              icon="mdi:upload" 
              @click=${onUploadRedirect}
              style="background: #007bff; color: white;"
            ></bim-button>
          </div>
        ` : filteredFiles.map(file => BUI.html`
          <div 
            style="
              padding: 0.75rem; 
              margin-bottom: 0.25rem; 
              background: ${selectedFile === file.name ? '#007bff20' : 'transparent'}; 
              border: 1px solid ${selectedFile === file.name ? '#007bff' : 'transparent'}; 
              border-radius: 4px; 
              cursor: pointer;
              transition: all 0.2s;
            "
            @click=${() => onFileSelect(file.name)}
            onmouseover="this.style.background='#2a2d32'"
            onmouseout="this.style.background='${selectedFile === file.name ? '#007bff20' : 'transparent'}'"
          >
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <bim-icon 
                icon="mdi:cube" 
                style="color: #007bff; font-size: 20px;"
              ></bim-icon>
              <div style="flex: 1; min-width: 0;">
                <div style="
                  font-weight: 500; 
                  color: #fff; 
                  font-size: 14px; 
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${file.name}
                </div>
                <div style="
                  color: #666; 
                  font-size: 12px; 
                  margin-top: 0.25rem;
                ">
                  ${formatFileSize(file.size)}
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <bim-button 
                  icon=${visibleFiles.includes(file.name) ? "mdi:eye-off" : "mdi:eye"}
                  @click=${() => onToggleVisibility(file.name)}
                  style="
                    background: ${visibleFiles.includes(file.name) ? '#dc3545' : '#28a745'}; 
                    color: white; 
                    border: none; 
                    padding: 0.25rem;
                    min-width: 32px;
                    height: 32px;
                  "
                  title=${visibleFiles.includes(file.name) ? 'Hide file' : 'Show file'}
                ></bim-button>
                <bim-button 
                  icon="mdi:delete"
                  @click=${() => onRemoveFromCard(file.name)}
                  style="
                    background: #dc3545; 
                    color: white; 
                    border: none; 
                    padding: 0.25rem;
                    min-width: 32px;
                    height: 32px;
                  "
                  title="Remove from card"
                ></bim-button>
                ${selectedFile === file.name ? BUI.html`
                  <bim-icon icon="mdi:check" style="color: #007bff;"></bim-icon>
                ` : ''}
              </div>
            </div>
          </div>
        `)}
      </div>

      <!-- Footer -->
      <div style="padding: 1rem; border-top: 1px solid #404040;">
        <bim-button 
          label="Upload New Files" 
          icon="mdi:upload" 
          @click=${onUploadRedirect}
          style="width: 100%; background: #28a745; color: white;"
        ></bim-button>
      </div>
    </div>
  `;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
