import os
from dotenv import load_dotenv

load_dotenv()  # Memuat file .env
print(f"{os.getenv('GEMINI_API_KEY')}")