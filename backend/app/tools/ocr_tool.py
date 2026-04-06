from pathlib import Path


def extract_image_text(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        return ""

    try:
        from PIL import Image
        import pytesseract

        image = Image.open(file_path)
        return pytesseract.image_to_string(image).strip()
    except Exception:
        return ""
