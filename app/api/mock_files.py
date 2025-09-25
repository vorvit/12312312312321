"""
Mock API для имитации ручной загрузки файлов пользователем
Этот эндпоинт обходит сложную логику аутентификации и предзагрузки
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.file import File
from app.models.user import User
from app.auth.context import require_current_user
import os
import json

router = APIRouter()

@router.get("/api/mock/files")
async def get_mock_files(current_user: User = Depends(require_current_user)):
    """
    Возвращает список файлов пользователя в упрощенном формате
    Обходит сложную логику предзагрузки
    """
    try:
        # Получаем файлы пользователя из базы данных
        db = next(get_db())
        try:
            files = db.query(File).filter(File.user_id == current_user.id).all()
            
            # Формируем упрощенный ответ
            mock_files = []
            for file in files:
                # Проверяем, что файл IFC
                if file.filename.lower().endswith(('.ifc', '.ifcxml', '.ifczip')):
                    mock_files.append({
                        "id": file.id,
                        "name": file.filename,
                        "original_name": file.original_filename,
                        "size": file.file_size,
                        "content_type": file.content_type,
                        "is_ifc": True,
                        "mock_url": f"/api/mock/files/{file.filename}/download"
                    })
            
            return JSONResponse({
                "success": True,
                "message": "Mock files loaded successfully",
                "data": mock_files,
                "count": len(mock_files)
            })
            
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading mock files: {str(e)}"
        )

@router.get("/api/mock/files/{filename}/download")
async def download_mock_file(
    filename: str,
    current_user: User = Depends(require_current_user)
):
    """
    Скачивание файла через упрощенный эндпоинт
    """
    try:
        db = next(get_db())
        try:
            # Находим файл в базе данных
            file_record = db.query(File).filter(
                File.filename == filename,
                File.user_id == current_user.id
            ).first()
            
            if not file_record:
                raise HTTPException(status_code=404, detail="File not found")
            
            # Читаем файл из MinIO
            from app.storage.service import StorageService
            storage = StorageService()
            
            try:
                file_data = storage.get_file(file_record.storage_path)
                
                from fastapi.responses import Response
                return Response(
                    content=file_data,
                    media_type="application/octet-stream",
                    headers={
                        "Content-Disposition": f"attachment; filename={filename}",
                        "Content-Length": str(len(file_data))
                    }
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error reading file from storage: {str(e)}"
                )
                
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error downloading file: {str(e)}"
        )

@router.post("/api/mock/files/load-to-viewer")
async def load_files_to_viewer(
    current_user: User = Depends(require_current_user)
):
    """
    Эндпоинт для загрузки файлов пользователя в viewer
    Имитирует ручную загрузку файлов пользователем
    """
    try:
        # Получаем файлы пользователя
        db = next(get_db())
        try:
            files = db.query(File).filter(File.user_id == current_user.id).all()
            
            ifc_files = []
            for file in files:
                if file.filename.lower().endswith(('.ifc', '.ifcxml', '.ifczip')):
                    ifc_files.append({
                        "filename": file.filename,
                        "size": file.file_size,
                        "path": file.storage_path
                    })
            
            return JSONResponse({
                "success": True,
                "message": f"Found {len(ifc_files)} IFC files for user",
                "files": ifc_files,
                "user_id": current_user.id,
                "username": current_user.username
            })
            
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading files to viewer: {str(e)}"
        )
