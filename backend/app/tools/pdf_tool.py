from pathlib import Path


def extract_pdf_text(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        return ""

    try:
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except Exception:
        return ""
