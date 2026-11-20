from PIL import Image, ImageDraw, ImageFont

def make(path, lines, size=(900, 700)):
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype("arial.ttf", 28)
    y = 50
    for line in lines:
        d.text((50, y), line, fill="black", font=font)
        y += 65
    img.save(path, "JPEG", quality=90)

make("test/big1.jpg", [
    "The restaurant industry faces a serious labor",
    "shortage. Skilled chefs are difficult to find,",
    "and many businesses now use robot-powered",
    "automation to cook burgers and deliver food.",
])
make("test/big2.jpg", [
    "A shortage of experienced cooks creates big",
    "problems for the food industry. Automated",
    "robot technology helps restaurants prepare",
    "hamburgers and offers fast delivery service.",
])
print("复杂测试图已生成")