import os
import re
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Pastikan folder penyimpanan file backend sudah dibuat
EXPORTS_DIR = os.path.join("static", "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)


class ChatMessage(BaseModel):
    message: str


class ChatController:
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

            konteks_sistem = f"""
            Anda adalah asisten AI pintar untuk aplikasi Vision Detection & Object Monitoring.
            Tugas Anda membantu pengguna menjawab pertanyaan seputar hasil deteksi kamera saat ini maupun tugas umum lainnya.

            Data Realtime Sistem:
            - Status: Aktif / Live Monitoring
            - Model Aktif: Model 1 (Green) & Model 2 (Red)
            - Jumlah deteksi terakhir Model 1 (Green): {cls.last_known_stats['model_1_count']}
            - Jumlah deteksi terakhir Model 2 (Red): {cls.last_known_stats['model_2_count']}

            Instruksi Pembuatan File:
            - Jika pengguna meminta untuk membuat file (seperti Excel/xlsx, CSV, PDF, Docx, TXT, dll), Anda WAJIB menggunakan Code Execution Python.
            - Buat file dengan nama file yang jelas (misal: Laporan_Deteksi_Objek.xlsx).
            - Di akhir jawaban, berikan link unduhan dengan format Markdown: [Nama File](/static/exports/nama_file.ext).

            Jawablah pertanyaan pengguna dengan ramah, informatif, dan berpatokan pada data sistem jika ditanyakan.
            """

            config = types.GenerateContentConfig(
                system_instruction=konteks_sistem,
                tools=[types.Tool(code_execution={})]
            )

            response = client.models.generate_content(
                model='gemini-3.5-flash-lite',
                contents=prompt,
                config=config
            )

            # --- Dapatkan File Output dari Execution Response Gemini ---
            if response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            # Periksa jika ada inline_data / file yang dihasilkan dari ekspresi Python Gemini
                            if hasattr(part, 'inline_data') and part.inline_data:
                                mime_type = part.inline_data.mime_type
                                data_bytes = part.inline_data.data
                                
                                # Tentukan ekstensi file berdasarkan MIME type
                                ext = ".xlsx"
                                if "csv" in mime_type:
                                    ext = ".csv"
                                elif "pdf" in mime_type:
                                    ext = ".pdf"
                                
                                file_path = os.path.join(EXPORTS_DIR, f"Laporan_Deteksi_Objek{ext}")
                                with open(file_path, "wb") as f:
                                    f.write(data_bytes)

            return response.text

        except Exception as e:
            return f"Terjadi kesalahan saat mengakses API Gemini: {str(e)}"