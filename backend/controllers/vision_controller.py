import base64
import cv2
import numpy as np
from ultralytics import YOLO
from concurrent.futures import ThreadPoolExecutor

# Inisialisasi model di level controller agar tidak dimuat berulang kali
model_1 = YOLO("models_onnx/model_1.onnx")
model_2 = YOLO("models_onnx/model_2.onnx")
executor = ThreadPoolExecutor(max_workers=2)

class VisionController:
    @staticmethod
    def draw_detections(frame, results, model, color):
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                label_name = model.names.get(cls_id, f"Class {cls_id}")
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = box.conf[0].item()

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

                text = f"{label_name} {conf:.2f}"
                (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1)
                cv2.putText(frame, text, (x1 + 3, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

                detections.append(
                    {"box": [x1, y1, x2, y2], "confidence": conf, "label": label_name}
                )
        return detections

    @classmethod
    def process_inference_cpu(cls, frame, mode="both"):
        hd_frame = frame.copy()
        output_1 = []
        output_2 = []

        if mode in ["model_1", "both"]:
            results_1 = model_1.predict(hd_frame, imgsz=480, verbose=False, workers=2)
            output_1 = cls.draw_detections(hd_frame, results_1, model_1, (0, 255, 0))

        if mode in ["model_2", "both"]:
            results_2 = model_2.predict(hd_frame, imgsz=480, verbose=False, workers=2)
            output_2 = cls.draw_detections(hd_frame, results_2, model_2, (0, 0, 255))

        success, buffer = cv2.imencode(".jpg", hd_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not success:
            return None, [], []

        frame_base64 = base64.b64encode(buffer).decode("utf-8")
        return frame_base64, output_1, output_2
