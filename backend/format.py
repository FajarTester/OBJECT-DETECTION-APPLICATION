from ultralytics import YOLO

# Ekspor kedua model ke format ONNX
model_1 = YOLO("models/model_1.pt")
model_1.export(format="onnx", dynamic=True)  # Menghasilkan models/model_1.onnx

model_2 = YOLO("models/model_2.pt")
model_2.export(format="onnx", dynamic=True)  # Menghasilkan models/model_2.onnx