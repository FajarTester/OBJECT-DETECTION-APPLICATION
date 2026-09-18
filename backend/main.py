import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from ultralytics import YOLO

app = FastAPI()

# Muat model ONNX jika sudah di-export, atau .pt jika belum
model_1 = YOLO("models_onnx/model_1.onnx")
model_2 = YOLO("models_onnx/model_2.onnx")

# Batasi thread agar CPU tidak tercekik (sesuaikan dengan core CPU Anda, misal 4 atau 8)
executor = ThreadPoolExecutor(max_workers=2)


def draw_detections(frame, results, model, color):
    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0].item())
            label_name = model.names.get(cls_id, f"Class {cls_id}")
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = box.conf[0].item()

            # Gambar box tebal untuk HD
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

            text = f"{label_name} {conf:.2f}"
            (tw, th), _ = cv2.getTextSize(
                text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
            )
            cv2.rectangle(
                frame, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1
            )
            cv2.putText(
                frame,
                text,
                (x1 + 3, y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )

            detections.append(
                {"box": [x1, y1, x2, y2], "confidence": conf, "label": label_name}
            )
    return detections


def process_inference_cpu(frame):
    # 1. Simpan frame asli resolusi tinggi (High Quality) untuk tampilan akhir
    hd_frame = frame.copy()

    # 2. Paksa YOLO memproses di ukuran kecil (480px) khusus CPU
    # imgsz=480 memangkas beban kerja CPU hingga 60% dibanding 640/1080
    results_1 = model_1.predict(
        hd_frame, imgsz=480, verbose=False, workers=2
    )
    results_2 = model_2.predict(
        hd_frame, imgsz=480, verbose=False, workers=2
    )

    # 3. Gambar detections langsung di atas frame HD asli
    output_1 = draw_detections(hd_frame, results_1, model_1, (0, 255, 0))
    output_2 = draw_detections(hd_frame, results_2, model_2, (0, 0, 255))

    # 4. Encode frame HD dengan Kualitas Bagus (Quality 80%)
    success, buffer = cv2.imencode(
        ".jpg", hd_frame, [cv2.IMWRITE_JPEG_QUALITY, 80]
    )
    if not success:
        return None, [], []

    frame_base64 = base64.b64encode(buffer).decode("utf-8")
    return frame_base64, output_1, output_2


@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Kamera terhubung (Optimasi CPU).")

    try:
        while True:
            data = await websocket.receive_bytes()
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # Jalankan inferensi di background thread agar WebSocket tidak hanged
            frame_base64, output_1, output_2 = await asyncio.to_thread(
                process_inference_cpu, frame
            )

            if frame_base64 is None:
                continue

            await websocket.send_json(
                {
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
        print(f"Error: {e}")