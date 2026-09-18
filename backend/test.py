import cv2
from ultralytics import YOLO

# 1. Muat model custom Anda (best.pt)
# Pastikan file 'best.pt' berada di folder yang sama dengan skrip ini, 
# atau tuliskan path lengkapnya (misal: 'C:/folder/best.pt')
model_2 = YOLO("models/model_2.pt")

# 2. Buka akses ke kamera
# Angka 0 adalah indeks untuk kamera bawaan/utama laptop atau PC
cap = cv2.VideoCapture(0)

# Periksa apakah kamera berhasil dibuka
if not cap.isOpened():
    print("Error: Kamera tidak dapat diakses.")
    exit()

print("Menjalankan model... Tekan tombol 'q' untuk keluar.")

while True:
    # Membaca frame demi frame dari kamera
    ret, frame = cap.read()
    if not ret:
        print("Error: Gagal mengambil gambar dari kamera.")
        break

    # 3. Jalankan deteksi objek pada frame aktif
    # stream=True membuat pemrosesan video lebih efisien dan hemat memori
    results_1 = model_2(frame, stream=True)

    # 4. Gambar hasil deteksi (bounding box dan label) ke frame
    for r in results_1:
        annotated_frame = r.plot()

    # 5. Tampilkan frame yang sudah diberi label ke dalam jendela layar
    cv2.imshow("YOLO Real-Time Detection", annotated_frame)

    # 6. Berhentikan program jika mendeteksi tombol 'q' ditekan
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# 7. Bersihkan dan tutup semua jendela setelah selesai
cap.release()
cv2.destroyAllWindows()