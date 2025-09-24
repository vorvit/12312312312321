import * as BUI from "@thatopen/ui";
import { AuthIntegration, AuthUser } from "../../auth-integration";

export interface UserPanelState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  showUserMenu: boolean;
}

export const userPanelTemplate: BUI.StatefullComponent<UserPanelState> = (
  state,
  update,
) => {
  const { user, isAuthenticated, showUserMenu } = state;
  const auth = AuthIntegration.getInstance();

  const onToggleUserMenu = () => {
    update({ showUserMenu: !state.showUserMenu });
  };

  const onLogout = async () => {
    await auth.logout();
  };

  const onRedirectToDashboard = () => {
    auth.redirectToDashboard();
    update({ showUserMenu: false });
  };

  const onRedirectToFileUpload = () => {
    auth.redirectToFileUpload();
    update({ showUserMenu: false });
  };

  if (!isAuthenticated) {
    return BUI.html`
      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
        <bim-button 
          label="Login" 
          icon="mdi:login" 
          @click=${() => window.open('http://localhost:8000/login', '_blank')}
          style="background-color: #007bff; color: white;"
        ></bim-button>
      </div>
    `;
  }

  return BUI.html`
    <div style="position: relative; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
      <!-- User Info -->
      <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" @click=${onToggleUserMenu}>
        <div style="
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background: linear-gradient(45deg, #007bff, #0056b3); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: white; 
          font-weight: bold;
          font-size: 14px;
        ">
          ${user?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <span style="font-size: 14px; font-weight: 500; color: #fff;">${user?.username || 'User'}</span>
          <span style="font-size: 12px; color: #ccc;">${user?.email || ''}</span>
        </div>
        <bim-icon icon="mdi:chevron-down" style="color: #ccc; font-size: 16px;"></bim-icon>
      </div>

      <!-- User Menu Dropdown -->
      ${showUserMenu ? BUI.html`
        <div style="
          position: absolute; 
          top: 100%; 
          right: 0; 
          background: #2a2d32; 
          border: 1px solid #404040; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
          z-index: 1000; 
          min-width: 200px; 
          padding: 0.5rem 0;
        ">
          <div style="padding: 0.5rem 1rem; border-bottom: 1px solid #404040;">
            <div style="font-size: 14px; font-weight: 500; color: #fff;">${user?.full_name || user?.username}</div>
            <div style="font-size: 12px; color: #ccc;">${user?.email}</div>
          </div>
          
          <div style="padding: 0.25rem 0;">
            <div style="
              padding: 0.5rem 1rem; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              gap: 0.5rem;
              color: #fff;
              font-size: 14px;
            " @click=${onRedirectToDashboard}>
              <bim-icon icon="mdi:view-dashboard" style="color: #007bff;"></bim-icon>
              Dashboard
            </div>
            
            <div style="
              padding: 0.5rem 1rem; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              gap: 0.5rem;
              color: #fff;
              font-size: 14px;
            " @click=${onRedirectToFileUpload}>
              <bim-icon icon="mdi:upload" style="color: #28a745;"></bim-icon>
              Upload Files
            </div>
            
            <div style="
              padding: 0.5rem 1rem; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              gap: 0.5rem;
              color: #dc3545;
              font-size: 14px;
            " @click=${onLogout}>
              <bim-icon icon="mdi:logout" style="color: #dc3545;"></bim-icon>
              Logout
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
};
