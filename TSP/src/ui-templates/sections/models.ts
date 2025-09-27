import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state,
) => {
  const { components } = state;

  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);

  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  const onAddIfcModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const model = await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
        console.log(`IFC file ${file.name} loaded successfully`);
      } catch (error) {
        console.error('Error loading IFC file:', error);
        alert(`Error loading file: ${error.message || 'Unknown error'}`);
      } finally {
        target.loading = false;
        BUI.ContextMenu.removeMenus();
      }
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onAddFragmentsModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        await fragments.core.load(bytes, {
          modelId: file.name.replace(".frag", ""),
        });
        console.log(`Fragments file ${file.name} loaded successfully`);
      } catch (error) {
        console.error('Error loading Fragments file:', error);
        alert(`Error loading file: ${error.message || 'Unknown error'}`);
      } finally {
        target.loading = false;
        BUI.ContextMenu.removeMenus();
      }
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  const onDashboard = () => {
    window.location.href = 'http://localhost:8000/dashboard';
  };

  return BUI.html`
    <div style="position: relative;">
      <bim-panel-section fixed icon=${appIcons.MODEL} label="Models">
        <div style="display: flex; gap: 0.5rem; align-items:center;">
          <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
          <bim-button style="flex: 0;" icon=${appIcons.ADD}>
            <bim-context-menu style="gap: 0.25rem;">
              <bim-button label="IFC" @click=${onAddIfcModel}></bim-button>
              <bim-button label="Fragments" @click=${onAddFragmentsModel}></bim-button>
            </bim-context-menu> 
          </bim-button>
        </div>
        ${modelsList}
      </bim-panel-section>
      <div style="position:absolute; top:6px; right:8px;">
        <bim-button @click=${onDashboard} icon="mdi:view-dashboard-outline" label="Dashboard"
          style="background: transparent; border: 1px solid var(--bim-ui_bg-contrast-40); color:#fff; border-radius:6px; height:28px; padding:0 10px; font-weight:600;">
        </bim-button>
      </div>
    </div>
  `;
};
