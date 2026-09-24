import os
from google import genai
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
# Definisikan skema input data
class ChatMessage(BaseModel):
    message: str

class ChatController:
    # Simpan status counter terakhir secara global (memory cache sederhana)
    # Di aplikasi nyata, Anda bisa menyimpan ini ke Redis atau database.
    last_known_stats = {
        "model_1_count": 0,
        "model_2_count": 0
    }

    @classmethod
    def update_stats(cls, m1_count, m2_count):
        cls.last_known_stats["model_1_count"] = m1_count
        cls.last_known_stats["model_2_count"] = m2_count

    @classmethod
    async def get_gemini_response(cls, prompt: str):
        if not os.environ.get("GEMINI_API_KEY"):
            return "Error: GEMINI_API_KEY belum diatur di environment variable backend."

        try:
            client = genai.Client()
            
            # Konteks dinamis yang diambil dari hasil deteksi kamera terakhir
            konteks_sistem = f"""
            Anda adalah asisten AI pintar untuk aplikasi Vision Detection & Object Monitoring.
            Tugas Anda membantu pengguna menjawab pertanyaan seputar hasil deteksi kamera saat ini.
            
            Data Realtime Sistem:
            - Status: Aktif / Live Monitoring
            - Model Aktif: Model 1 (Green) & Model 2 (Red)
            - Jumlah deteksi terakhir Model 1 (Green): {cls.last_known_stats['model_1_count']}
            - Jumlah deteksi terakhir Model 2 (Red): {cls.last_known_stats['model_2_count']}
            
            Jawablah pertanyaan pengguna dengan ramah, singkat, dan berpatokan pada data tersebut.
            """

            response = client.models.generate_content(
                model='gemini-3.1-flash-lite',
                contents=prompt,
                config={"system_instruction": konteks_sistem}
            )
            return response.text
        except Exception as e:
            return f"Terjadi kesalahan saat mengakses API Gemini: {str(e)}"
