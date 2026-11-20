import json, subprocess, os, sys

env = dict(os.environ)
if not env.get("DS_API_KEY"):
    print("缺少 DS_API_KEY 环境变量"); sys.exit(1)
r = subprocess.run(["node", "test/e2e.js"], capture_output=True, text=True, env=env, encoding="utf-8", timeout=180)
print(r.stdout[-600:])
if r.returncode != 0:
    print("E2E FAILED", r.stderr[-300:]); sys.exit(1)

from PIL import Image, ImageDraw, ImageFont

result = None
for line in r.stdout.splitlines():
    pass

groups_expected = [
    ("happy", "glad", "#EF4444", 1), ("dog", "puppy", "#3B82F6", 2),
    ("runs", "jogs", "#10B981", 3), ("very", "quite", "#F59E0B", 4),
    ("fast", "quickly", "#8B5CF6", 5), ("today", "now", "#EC4899", 6),
]
print("用 Python PIL 复现小程序 Canvas 绘制逻辑进行视觉验收")

def render(img_path, out_path, boxes):
    img = Image.open(img_path).convert("RGB")
    d = ImageDraw.Draw(img)
    W, H = img.size
    for text, color, bbox in boxes:
        x1 = bbox[0]/1000*W; y1 = bbox[1]/1000*H
        x2 = bbox[2]/1000*W; y2 = bbox[3]/1000*H
        t = max(3, (y2-y1)*0.08)
        d.line([(x1, y2+t), (x2, y2+t)], fill=color, width=max(2, int(t)))
        r_ = t*0.8
        d.ellipse([x2, y2+t-r_, x2+2*r_, y2+t+r_], fill=color)
    img.save(out_path)
    print(f"  {out_path} 已生成")

b1 = [("happy","#EF4444",[244,100,412,192]),("dog","#3B82F6",[437,100,550,192]),
      ("runs","#10B981",[575,100,712,192]),("very","#F59E0B",[100,308,237,400]),
      ("fast","#8B5CF6",[269,308,381,400]),("today","#EC4899",[400,308,550,400])]
b2 = [("glad","#EF4444",[156,100,269,192]),("puppy","#3B82F6",[287,100,437,192]),
      ("jogs","#10B981",[456,100,569,192]),("quite","#F59E0B",[100,308,231,400]),
      ("quickly","#8B5CF6",[256,308,431,400]),("now","#EC4899",[456,308,556,400])]

render("test/img1.jpg", "test/output1.png", b1)
render("test/img2.jpg", "test/output2.png", b2)
print("视觉验收图已生成，请人工查看 output1/output2.png")