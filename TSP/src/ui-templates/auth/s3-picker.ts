import * as OBC from "@thatopen/components";
import { AuthIntegration } from "../../auth-integration";

type S3PickerOptions = {
  onLoaded?: (filenames: string[]) => void;
};

export async function openS3PickerModal(components: OBC.Components, options?: S3PickerOptions) {
  const ifcLoader = components.get(OBC.IfcLoader);
  const auth = AuthIntegration.getInstance();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    width: 720px;
    max-width: 95vw;
    max-height: 85vh;
    background: #1a1d23;
    color: #fff;
    border: 1px solid #404040;
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    border-bottom: 1px solid #404040;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  header.innerHTML = `<div style="font-weight:600">S3 Storage · Select IFC files</div>`;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.style.cssText = `
    background: transparent; color: #aaa; border: none; font-size: 20px; cursor: pointer;
  `;
  closeBtn.onclick = () => document.body.removeChild(overlay);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = `
    padding: 12px 16px;
    overflow: auto;
    flex: 1;
  `;

  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex; gap: 8px; margin-bottom: 12px; align-items: center;
  `;
  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search files...';
  search.style.cssText = `flex:1; background:#2a2d32; color:#fff; border:1px solid #404040; border-radius:4px; padding:8px;`;
  controls.appendChild(search);

  const loadAllBtn = document.createElement('button');
  loadAllBtn.textContent = 'Load all';
  loadAllBtn.style.cssText = `background:#2a2d32; color:#fff; border:1px solid #404040; border-radius:4px; padding:8px 12px; cursor:pointer;`;
  controls.appendChild(loadAllBtn);

  const list = document.createElement('div');
  list.style.cssText = `display:flex; flex-direction:column; gap:6px;`;

  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 16px;
    border-top: 1px solid #404040;
    display: flex; gap: 8px; justify-content: flex-end;
  `;
  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'Load selected';
  loadBtn.style.cssText = `background:#28a745; color:#fff; border:none; border-radius:4px; padding:8px 12px; cursor:pointer;`;
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `background:#2a2d32; color:#fff; border:1px solid #404040; border-radius:4px; padding:8px 12px; cursor:pointer;`;
  footer.appendChild(cancelBtn);
  footer.appendChild(loadBtn);

  body.appendChild(controls);
  body.appendChild(list);
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  cancelBtn.onclick = () => document.body.removeChild(overlay);

  // State
  let allFiles: { name: string; size: number; is_ifc: boolean }[] = [];
  let selected = new Set<string>();

  const getFiltered = () => {
    const query = search.value.toLowerCase();
    const filtered = allFiles.filter(f => f.is_ifc && f.name.toLowerCase().includes(query));
    return filtered;
  };

  const renderList = () => {
    const filtered = getFiltered();
    list.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888; padding:12px; text-align:center;';
      empty.textContent = 'No IFC files';
      list.appendChild(empty);
      return;
    }
    for (const f of filtered) {
      const row = document.createElement('label');
      row.style.cssText = `display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid #303238; border-radius:6px; background:#20232a;`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(f.name);
      cb.onchange = () => {
        if (cb.checked) selected.add(f.name); else selected.delete(f.name);
      };
      const name = document.createElement('div');
      name.style.cssText = 'flex:1; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
      name.textContent = f.name;
      const size = document.createElement('div');
      size.style.cssText = 'color:#aaa; font-size:12px;';
      size.textContent = `${(f.size/1024/1024).toFixed(2)} MB`;
      row.appendChild(cb);
      row.appendChild(name);
      row.appendChild(size);
      list.appendChild(row);
    }
  };

  const loadFiles = async () => {
    try {
      allFiles = await auth.loadUserFiles();
      renderList();
    } catch (e) {
      console.error('Failed to load user files list:', e);
      renderList();
    }
  };

  // Load all currently filtered files
  loadAllBtn.onclick = async () => {
    try {
      loadAllBtn.disabled = true;
      // Ensure we have an up-to-date list on first use
      if (allFiles.length === 0) {
        try { allFiles = await auth.loadUserFiles(); } catch {}
      }
      const filtered = getFiltered();
      const toLoad = filtered.map(f => f.name);
      for (const filename of toLoad) {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) continue;
          const url = `http://localhost:8000/api/files/download/${filename}?token=${token}`;
          const resp = await fetch(url, { headers: { 'Content-Type': 'application/octet-stream' } });
          if (!resp.ok) { console.warn('Download failed:', filename, resp.status); continue; }
          const buf = await resp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const modelId = filename.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
          await ifcLoader.load(bytes, true, modelId);
        } catch (e) {
          console.error('Load error for', filename, e);
        }
      }
      options?.onLoaded?.(toLoad);
    } finally {
      loadAllBtn.disabled = false;
    }
  };
  search.oninput = renderList;
  void loadFiles();

  loadBtn.onclick = async () => {
    try {
      loadBtn.disabled = true;
      const toLoad = Array.from(selected);
      for (const filename of toLoad) {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) continue;
          const url = `http://localhost:8000/api/files/download/${filename}?token=${token}`;
          const resp = await fetch(url, { headers: { 'Content-Type': 'application/octet-stream' } });
          if (!resp.ok) { console.warn('Download failed:', filename, resp.status); continue; }
          const buf = await resp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const modelId = filename.replace(/\.(ifc|ifcxml|ifczip)$/i, '');
          await ifcLoader.load(bytes, true, modelId);
        } catch (e) {
          console.error('Load error for', filename, e);
        }
      }
      options?.onLoaded?.(toLoad);
    } finally {
      document.body.removeChild(overlay);
    }
  };
}


