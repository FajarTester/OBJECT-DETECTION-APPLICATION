import asyncio
import json
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from controllers.vision_controller import VisionController
from controllers.chat_controller import ChatController

router = APIRouter()

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Kamera terhubung (Optimasi CPU via Router).")
    active_mode = "both"

    try:
        while True:
            message = await websocket.receive()

            if "text" in message:
                try:
                    payload = json.loads(message["text"])
                    if "mode" in payload and payload["mode"] in ["model_1", "model_2", "both"]:
                        active_mode = payload["mode"]
                        print(f"Mode inferensi diubah ke: {active_mode}")
                        await websocket.send_json({"status": "mode_changed", "current_mode": active_mode})
                except json.JSONDecodeError:
                    pass
                continue

            if "bytes" in message:
                data = message["bytes"]
                nparr = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None:
                    continue

                # Panggil pemrosesan dari VisionController
                frame_base64, output_1, output_2 = await asyncio.to_thread(
                    VisionController.process_inference_cpu, frame, active_mode
                )

                if frame_base64 is None:
                    continue

                # Kirim pembaruan jumlah objek ke ChatController agar AI chatbot selalu mendapat data terbaru
                ChatController.update_stats(len(output_1), len(output_2))

                await websocket.send_json(
                    {
                        "active_mode": active_mode,
                        "image": frame_base64,
                        "model_1_count": len(output_1),
                        "model_2_count": len(output_2),
                        "model_1": output_1,
                        "model_2": output_2,
                    }
                )

    except WebSocketDisconnect:
        print("Kamera terputus.")
    except Exception as e:
        print(f"Error pada WebSocket: {e}")
