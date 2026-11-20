from PIL import Image

def check(path, boxes, label):
    img = Image.open(path).convert("RGB")
    W, H = img.size
    px = img.load()
    ok = 0
    for text, color, bbox in boxes:
        rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
        x1 = bbox[0]/1000*W; y1 = bbox[1]/1000*H
        x2 = bbox[2]/1000*W; y2 = bbox[3]/1000*H
        t = max(3, (y2-y1)*0.08)
        cy = int(y2 + t)
        found = 0
        scan_y = range(max(0, cy-4), min(H, cy+5))
        for y in scan_y:
            for x in range(int(x1), int(x2)):
                p = px[x, y]
                if all(abs(p[i]-rgb[i]) < 40 for i in range(3)):
                    found += 1
        status = "PASS" if found >= 10 else "FAIL"
        if status == "PASS": ok += 1
        print(f"  [{status}] {text:8s} 颜色{color} 单词下方命中像素 {found}")
    print(f"{label}: {ok}/{len(boxes)} 通过")
    return ok == len(boxes)

b1 = [("happy","#EF4444",[244,100,412,192]),("dog","#3B82F6",[437,100,550,192]),
      ("runs","#10B981",[575,100,712,192]),("very","#F59E0B",[100,308,237,400]),
      ("fast","#8B5CF6",[269,308,381,400]),("today","#EC4899",[400,308,550,400])]
b2 = [("glad","#EF4444",[156,100,269,192]),("puppy","#3B82F6",[287,100,437,192]),
      ("jogs","#10B981",[456,100,569,192]),("quite","#F59E0B",[100,308,231,400]),
      ("quickly","#8B5CF6",[256,308,431,400]),("now","#EC4899",[456,308,556,400])]

ok1 = check("test/output1.png", b1, "图片一")
ok2 = check("test/output2.png", b2, "图片二")
print("视觉验收:", "全部通过" if (ok1 and ok2) else "存在失败")
exit(0 if (ok1 and ok2) else 1)