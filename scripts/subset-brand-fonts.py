"""Rebuild the local Noto Latin subsets from verified upstream files, offline."""

import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "assets" / "brand" / "fonts"
FONTTOOLS_VERSION = "4.68.0"
UNICODES = (
    "U+0000-024F,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,"
    "U+2122,U+2190-2199,U+2212,U+FEFF,U+FFFD"
)


def rebuild(originals):
    import fontTools
    from fontTools import subset
    from fontTools.ttLib import TTFont

    if fontTools.version != FONTTOOLS_VERSION:
        raise ValueError(f"FontTools {FONTTOOLS_VERSION} requis, version reçue : {fontTools.version}")
    manifest_path = FONT_DIR / "sources.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    glyphs_path = FONT_DIR / "glyphs.json"
    glyphs = json.loads(glyphs_path.read_text(encoding="utf-8"))
    corpus = glyphs["corpus"]
    pending = {}
    coverage = []
    for entry in manifest["files"]:
        if not entry["file"].startswith("NotoSans-"):
            continue
        contents = (originals / entry["file"]).read_bytes()
        upstream = entry.get(
            "upstream", {"bytes": entry["bytes"], "sha256": entry["sha256"]}
        )
        if len(contents) != upstream["bytes"] or sha256(contents).hexdigest() != upstream["sha256"]:
            raise ValueError(f"Source amont différente du manifeste : {entry['file']}")
        font = TTFont(BytesIO(contents), recalcTimestamp=False)
        original_cmap = font.getBestCmap()
        advances = {point: font["hmtx"][glyph][0] for point, glyph in original_cmap.items()}
        options = subset.Options()
        options.recalc_timestamp = False
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.layout_features = ["*"]
        options.notdef_outline = True
        options.recommended_glyphs = True
        subsetter = subset.Subsetter(options=options)
        requested = set(subset.parse_unicodes(UNICODES))
        subsetter.populate(unicodes=requested)
        subsetter.subset(font)
        output = BytesIO()
        font.save(output)
        result = output.getvalue()
        rebuilt = TTFont(BytesIO(result))
        retained = rebuilt.getBestCmap()
        if set(retained) != set(original_cmap) & requested:
            raise ValueError(f"Couverture différente des plages demandées : {entry['file']}")
        required = corpus + glyphs.get("notoAdditionalCorpus", "")
        missing = [character for character in required if ord(character) not in retained]
        if missing:
            raise ValueError(f"Glyphes requis absents : {entry['file']} {missing}")
        for codepoint in retained:
            if rebuilt["hmtx"][retained[codepoint]][0] != advances[codepoint]:
                raise ValueError(f"Avance modifiée : {entry['file']} U+{codepoint:04X}")
        pending[entry["file"]] = result
        entry.update(upstream=upstream, bytes=len(result), sha256=sha256(result).hexdigest())
        coverage.append({
            "font": entry["file"],
            "sourceCodepoints": len(original_cmap),
            "retainedCodepoints": len(retained),
        })
    # Verify every face before replacing any delivered file or report.
    results = []
    for entry in manifest["files"]:
        if not entry["file"].endswith(".ttf"):
            continue
        contents = pending.get(entry["file"])
        font = (
            TTFont(BytesIO(contents))
            if contents is not None else TTFont(FONT_DIR / entry["file"])
        )
        required = corpus
        if entry["file"].startswith("NotoSans-"):
            required += glyphs.get("notoAdditionalCorpus", "")
        missing = [character for character in required if ord(character) not in font.getBestCmap()]
        if missing:
            raise ValueError(f"Glyphes requis absents : {entry['file']} {missing}")
        results.append({"font": entry["file"], "missing": missing})
    manifest["subset"] = {
        "tool": "fonttools", "version": FONTTOOLS_VERSION,
        "script": "scripts/subset-brand-fonts.py",
        "unicodes": UNICODES, "coverage": coverage,
    }
    for filename, contents in pending.items():
        (FONT_DIR / filename).write_bytes(contents)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n",
    )
    glyphs["results"] = sorted(results, key=lambda result: result["font"])
    glyphs_path.write_text(
        json.dumps(glyphs, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n",
    )
    print(json.dumps({
        "fonts": [{"file": name, "bytes": len(data)} for name, data in pending.items()],
        "coverage": coverage,
    }, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--originals", required=True, type=Path,
        help="Dossier des deux TTF amont identiques au manifeste (aucun téléchargement).",
    )
    args = parser.parse_args()
    rebuild(args.originals.resolve())
