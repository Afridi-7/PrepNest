from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.core.security import decode_access_token
from app.models import User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

DEV_MODE = True


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    if DEV_MODE:
        mock_user = User()
        mock_user.id = user_id
        mock_user.email = f"dev_{user_id[:8]}@prepnest.app"
        mock_user.password_hash = "mock"
        mock_user.full_name = "Dev User"
        mock_user.is_active = True
        mock_user.preferences = {"learning_level": "intermediate"}
        mock_user.created_at = datetime.now()
        return mock_user

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
