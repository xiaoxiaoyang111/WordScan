from PIL import Image

def check(path, boxes, label):
    img = Image.open(path).convert("RGB")
    W, H = img.size
    px = img.load()
    ok = 0
    cover_fail = 0
    for text, color, bbox in boxes:
        rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
        x1 = bbox[0]/1000*W; y1 = bbox[1]/1000*H
        x2 = bbox[2]/1000*W; y2 = bbox[3]/1000*H
        t = max(2, (y2-y1)*0.035)
        cy = int(y2 + 2)
        found = 0
        scan_y = range(max(0, cy-4), min(H, cy+5))
        for y in scan_y:
            for x in range(int(x1), int(x2)):
                p = px[x, y]
                if all(abs(p[i]-rgb[i]) < 40 for i in range(3)):
                    found += 1
        line_ok = found >= 5
        cover_ok = True
        mid = int((x1 + x2) / 2)
        for y in range(max(0, int(y1)), min(H, int(y2)-2)):
            p = px[min(mid, W-1), y]
            if all(abs(p[i]-rgb[i]) < 40 for i in range(3)):
                cover_ok = False
                break
        if line_ok and cover_ok:
            ok += 1
        if not cover_ok:
            cover_fail += 1
        print(f"  [{'PASS' if line_ok and cover_ok else 'FAIL'}] {text:8s} 线命中{found:4d}px 覆盖单词={'无' if cover_ok else '是!'}")
    print(f"{label}: {ok}/{len(boxes)} 通过 (覆盖单词失败 {cover_fail})")
    return ok == len(boxes)

b1 = [("happy","#EF4444",[244,100,412,192]),("dog","#3B82F6",[437,100,550,192]),
      ("runs","#10B981",[575,100,712,192]),("very","#F59E0B",[100,308,237,400]),
      ("fast","#8B5CF6",[269,308,381,400]),("today","#EC4899",[400,308,550,400])]
b2 = [("glad","#EF4444",[156,100,269,192]),("puppy","#3B82F6",[287,100,437,192]),
      ("jogs","#10B981",[456,100,569,192]),("quite","#F59E0B",[100,308,231,400]),
      ("quickly","#8B5CF6",[256,308,431,400]),("now","#EC4899",[456,308,556,400])]

ok1 = check("test/output1.png", b1, "图片一")
ok2 = check("test/output2.png", b2, "图片二")
print("视觉验收:", "全部通过（划线存在且不覆盖单词）" if (ok1 and ok2) else "存在失败")
exit(0 if (ok1 and ok2) else 1)