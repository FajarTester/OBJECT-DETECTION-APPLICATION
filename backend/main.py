import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.vision_routes import router as vision_router
from routers.chat_routes import router as chat_router

app = FastAPI(title="AI Vision & Chatbot API")

# Setup CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ubah ke URL spesifik frontend Anda saat produksi
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrasi file routes (Router) ke dalam aplikasi utama
app.include_router(vision_router)
app.include_router(chat_router)

@app.get("/")
def index():
    return {"message": "Backend API Server Berjalan Lancar"}

if __name__ == "__main__":
    # Menjalankan server aplikasi
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
