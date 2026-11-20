from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs("test", exist_ok=True)

def make_image(path, lines, size=(800, 600)):
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 48)
    except Exception:
        font = ImageFont.load_default()
    y = 60
    for line in lines:
        d.text((80, y), line, fill="black", font=font)
        y += 120
    img.save(path, "JPEG", quality=90)
    print(f"{path} -> {size}")

make_image("test/img1.jpg", [
    "The happy dog runs",
    "very fast today"
])

make_image("test/img2.jpg", [
    "A glad puppy jogs",
    "quite quickly now"
])
print("done")