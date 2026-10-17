"""Build the shipped OFL font subset; run with fonttools[woff]==4.67.0.

The upstream font is kept in ignored artifacts/fonts, never fetched at game runtime.
See public/fonts/README.md for source and redistribution details.
"""
from pathlib import Path
from hashlib import sha256
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
chars = set(chr(n) for n in range(32, 127))
for path in [root / "index.html", *sorted((root / "src").glob("**/*.ts"))]:
    chars.update(path.read_text())
chars.update("♠♥♣♦←→↑↓✓×−—…◇%0123456789,./")
source = root / "artifacts/fonts/NotoSerifSC.ttf"
if sha256(source.read_bytes()).hexdigest() != "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9":
    raise ValueError("Upstream font revision differs; review it before regenerating the shipped subset.")
font = TTFont(source)
options = subset.Options()
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 14, 16, 17, 25]
options.name_legacy = True
options.layout_features = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="".join(sorted(chars)))
subsetter.subset(font)
# A subset is a modified font. Rename family/PostScript identifiers while retaining attribution.
for name in font["name"].names:
    if name.nameID in [1, 3, 4, 6, 16, 25]:
        text = name.toUnicode().replace("NotoSerifSC", "WendaoSerif").replace("Noto Serif SC", "Wendao Serif")
        name.string = text.encode(name.getEncoding())
font.flavor = "woff2"
destination = root / "public/fonts/wendao-serif.woff2"
font.save(destination)
print(f"{destination.name}: {destination.stat().st_size:,} bytes, {len(font.getBestCmap())} mapped characters")
