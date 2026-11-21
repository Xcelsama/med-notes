"""Draws the PNG app icons (Android/iOS need PNGs to install the app on a home screen).
Run:  python3 scripts/make-icons.py      (needs Pillow)"""
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
BLUE, PAPER, LINE, MARGIN, RED, INK = "#2457c5", "#fffdf4", "#cddff2", "#ee8b93", "#c4552d", "#232b3a"


def draw(size, maskable=False):
    S = 4  # supersample for smooth edges
    W = size * S
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = W / 512.0
    if maskable:
        d.rectangle([0, 0, W, W], fill=BLUE)
    else:
        d.rounded_rectangle([0, 0, W, W], radius=112 * u, fill=BLUE)
    scale = 0.78 if maskable else 1.0  # keep art inside the maskable safe zone

    page = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    p = ImageDraw.Draw(page)

    def P(v):  # map a 512-space coordinate through the scale around the centre
        return (256 + (v - 256) * scale) * u

    p.rounded_rectangle([P(126), P(94), P(398), P(434)], radius=22 * u * scale, fill=(0, 0, 0, 46))
    p.rounded_rectangle([P(120), P(86), P(392), P(426)], radius=22 * u * scale, fill=PAPER)
    for y in (168, 214, 260, 306, 352):
        p.line([P(150), P(y), P(372), P(y)], fill=LINE, width=max(1, int(5 * u * scale)))
    p.line([P(178), P(86), P(178), P(426)], fill=MARGIN, width=max(1, int(6 * u * scale)))
    for y in (140, 236, 332):
        r = 9 * u * scale
        p.ellipse([P(146) - r, P(y) - r, P(146) + r, P(y) + r], fill=BLUE)
    # handwriting squiggle
    pts = [(214 + i * 3, 128 + math.sin(i / 6.0) * 14) for i in range(0, 42)]
    p.line([(P(x), P(y)) for x, y in pts], fill=RED, width=max(1, int(12 * u * scale)), joint="curve")
    for (x1, x2, y) in ((214, 334, 196), (214, 306, 242), (214, 342, 288)):
        p.line([P(x1), P(y), P(x2), P(y)], fill=INK, width=max(1, int(10 * u * scale)))
    page = page.rotate(4, resample=Image.BICUBIC, center=(W / 2, W / 2))
    img.alpha_composite(page)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    draw(192).save(os.path.join(OUT, "icon-192.png"))
    draw(512).save(os.path.join(OUT, "icon-512.png"))
    draw(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
    print("icons written to", os.path.abspath(OUT))
