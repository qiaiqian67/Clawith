from PIL import Image, ImageDraw
import math

# The ZeroX mark: a rounded square in the ZeroX violet with two eyes, drawn
# after the OpenBot lockup shape but in the ZeroX color.
SIZE = 1024
BG = (124, 92, 255)      # --zx-logo-production
EYE = (4, 0, 7)          # --zx-logo-eye

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
radius = int(SIZE * 0.22)
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=BG)

# Two round eyes, slightly inset, matching the OpenBot lockup proportions.
eye_r = int(SIZE * 0.105)
eye_d = eye_r * 2
cy = int(SIZE * 0.47)
for cx in (int(SIZE * 0.355), int(SIZE * 0.645)):
    draw.ellipse([cx - eye_r, cy - eye_r, cx + eye_r, cy + eye_r], fill=EYE)

img.save("desktop/build/icon.png")
print("icon written", img.size)
