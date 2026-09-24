from fastapi import APIRouter, HTTPException
from controllers.chat_controller import ChatController, ChatMessage

router = APIRouter()

@router.post("/api/chatbot")
async def chat_endpoint(payload: ChatMessage):
    reply = await ChatController.get_gemini_response(payload.message)
    
    if "Error" in reply or "Terjadi kesalahan" in reply:
        raise HTTPException(status_code=500, detail=reply)
        
    return {"status": "success", "reply": reply}
