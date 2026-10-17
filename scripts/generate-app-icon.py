#!/usr/bin/env python3
"""Generate PoliVid's app icon set from the white "P" mark.

Research baked in (see PR notes):
- Evil Martians, "How to Favicon in 2026": ship favicon.ico, a 180px
  apple-touch icon, and manifest icons at 192/512 + a maskable 512 whose
  artwork stays inside the central 409px safe circle.
- Apple HIG / WWDC25 app icons: bold silhouette, no sharp/thin edges,
  centred artwork with breathing room, softer gradients, subtle depth.
- Premium purple icons (ONVO, Dribbble gradient set): deep violet base,
  one soft glow, white mark -- never a flat black field.

The source mark's alpha is binary (stair-stepped), so the mask is
supersampled 4x, blurred and re-levelled with a smoothstep curve. That
keeps the silhouette's size but replaces jaggies with a ~2px
anti-aliased edge at master size, which stays smooth at 16px.

Usage: python3 scripts/generate-app-icon.py
Outputs: app/icon.png, app/apple-icon.png, app/favicon.ico,
         public/icon-192.png, public/icon-512.png, public/icon-mask.png,
         public/brand/polivid-icon-1024.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "polivid-mark-white.png"
RENDER = 2048  # supersample; every export is a Lanczos downscale of this


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diagonal_gradient(size, stops):
    """Small multi-stop diagonal gradient, bicubic-upscaled for smoothness."""
    small = 256
    img = Image.new("RGB", (small, small))
    px = img.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
                if p0 <= t <= p1:
                    px[x, y] = lerp(c0, c1, (t - p0) / (p1 - p0))
                    break
    return img.resize((size, size), Image.BICUBIC)


def glow_orb(base, center, radius, color, alpha):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius * 0.55))
    base.alpha_composite(layer)


def background(size):
    # Deep violet diagonal: lit top-left, near-black purple at the base.
    img = diagonal_gradient(size, [
        (0.0, (54, 19, 104)),    # violet-900 lit
        (0.42, (33, 12, 72)),
        (0.75, (18, 7, 42)),
        (1.0, (10, 3, 23)),
    ]).convert("RGBA")
    # Soft colour glows, kept off the mark so the white stays the hero.
    glow_orb(img, (size * 0.78, size * 0.10), size * 0.52, (168, 85, 247), 76)
    glow_orb(img, (size * 0.06, size * 0.96), size * 0.46, (88, 28, 180), 72)
    glow_orb(img, (size * 0.50, size * 0.46), size * 0.42, (124, 58, 237), 46)
    # Top sheen + bottom vignette for depth (Apple: softer light, layered).
    sheen = Image.new("L", (1, size))
    for y in range(size):
        sheen.putpixel((0, y), max(0, int(34 * (1 - y / (size * 0.42)))))
    img.alpha_composite(Image.merge("RGBA", (
        Image.new("L", (size, size), 255),) * 3 + (sheen.resize((size, size)),)))
    shade = Image.new("L", (1, size))
    for y in range(size):
        t = max(0.0, (y / size - 0.62) / 0.38)
        shade.putpixel((0, y), int(72 * t * t))
    black = Image.merge("RGBA", (Image.new("L", (size, size), 0),) * 3 + (shade.resize((size, size)),))
    img.alpha_composite(black)
    return img


def smooth_mask(target_w):
    """White mark alpha, de-jaggied: 4x supersample -> blur -> smoothstep."""
    src = Image.open(SOURCE).convert("RGBA").getchannel("A")
    src = src.crop(src.getbbox())
    target_h = round(target_w * src.height / src.width)
    big = src.resize((target_w * 4, target_h * 4), Image.LANCZOS)
    big = big.filter(ImageFilter.GaussianBlur(radius=target_w * 4 * 0.006))
    # Smoothstep between 64..191: preserves the 50% edge (same silhouette
    # size) while spreading the transition over several pixels.
    curve = []
    for i in range(256):
        t = min(1.0, max(0.0, (i - 64) / 127))
        curve.append(round(255 * t * t * (3 - 2 * t)))
    big = big.point(curve)
    return big.resize((target_w, target_h), Image.LANCZOS)


def render(mark_fraction, size=RENDER):
    img = background(size)
    mask = smooth_mask(round(size * mark_fraction))
    x = (size - mask.width) // 2
    y = (size - mask.height) // 2 - round(size * 0.012)  # optical lift

    # Violet halo + soft drop shadow lift the mark off the field.
    def full_mask(scale):
        layer = Image.new("L", img.size, 0)
        layer.paste(mask.point(lambda a: int(a * scale)), (x, y))
        return layer

    tint = Image.new("RGBA", img.size, (167, 139, 250, 255))
    tint.putalpha(full_mask(0.16).filter(ImageFilter.GaussianBlur(radius=size * 0.018)))
    img.alpha_composite(tint)

    shadow = Image.new("RGBA", img.size, (4, 1, 12, 255))
    shadow.putalpha(full_mask(0.55).filter(ImageFilter.GaussianBlur(radius=size * 0.010)))
    img.alpha_composite(shadow, (0, round(size * 0.010)))

    # Near-white fill with the faintest vertical falloff, never flat paper.
    fill_small = Image.new("RGB", (1, 256))
    for i in range(256):
        fill_small.putpixel((0, i), lerp((255, 255, 255), (232, 226, 255), i / 255))
    fill = fill_small.resize(mask.size)
    mark = Image.merge("RGBA", (*fill.split(), mask))
    img.alpha_composite(mark, (x, y))
    return img


def save(img, path, size):
    out = img.resize((size, size), Image.LANCZOS) if img.width != size else img
    out.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {size}x{size}")


def main():
    master = render(mark_fraction=0.575)          # ~21% padding each side
    maskable = render(mark_fraction=0.50)         # stays in 409/512 safe circle
    tiny = render(mark_fraction=0.70)             # bolder glyph for 16-48px

    (ROOT / "public" / "brand").mkdir(parents=True, exist_ok=True)
    save(master, ROOT / "public" / "brand" / "polivid-icon-1024.png", 1024)
    save(master, ROOT / "app" / "icon.png", 512)
    save(master, ROOT / "app" / "apple-icon.png", 180)
    save(master, ROOT / "public" / "icon-512.png", 512)
    save(master, ROOT / "public" / "icon-192.png", 192)
    save(maskable, ROOT / "public" / "icon-mask.png", 512)

    ico_path = ROOT / "app" / "favicon.ico"
    tiny.resize((48, 48), Image.LANCZOS).save(
        ico_path, format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[tiny.resize((32, 32), Image.LANCZOS),
                       tiny.resize((16, 16), Image.LANCZOS)],
    )
    print(f"{ico_path.relative_to(ROOT)}  16/32/48")


if __name__ == "__main__":
    main()
