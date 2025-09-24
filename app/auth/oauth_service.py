from config import settings
import httpx

# OAuth endpoints
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_ACCESS_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

class OAuthService:
    @staticmethod
    def get_google_authorize_url(redirect_uri: str) -> str:
        """Generate Google OAuth authorization URL"""
        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'offline'
        }
        
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{GOOGLE_AUTHORIZE_URL}?{query_string}"
    
    @staticmethod
    async def get_google_user_info(access_token: str) -> dict:
        """Get user info from Google using access token"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_USER_INFO_URL,
                headers={'Authorization': f'Bearer {access_token}'}
            )
            return response.json()
