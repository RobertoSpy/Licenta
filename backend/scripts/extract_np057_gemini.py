import os
import sys
from pathlib import Path

import fitz  # PyMuPDF
from google import genai


def render_page_png_bytes(page: fitz.Page, scale: float) -> bytes:
    matrix = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    return pix.tobytes("png")


def main() -> int:
    pdf_path = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else Path(__file__).resolve().parents[1] / "docsAI" / "17_18 _NP_057_2002.pdf"
    )
    output_path = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[1] / "docsAI" / "17_18_NP_057_2002.md"
    )

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}")
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / ".env"

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and env_path.exists():
        # Minimal .env loader (KEY=VALUE, ignores comments and blank lines)
        with env_path.open("r", encoding="utf-8") as env_file:
            for line in env_file:
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key == "GEMINI_API_KEY" and value:
                    api_key = value
                    break

    if not api_key:
        print("GEMINI_API_KEY is not set in the environment.")
        return 1

    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    scale = float(os.environ.get("GEMINI_PDF_SCALE", "2.0"))

    client = genai.Client(api_key=api_key)
    doc = fitz.open(pdf_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as out:
        out.write(f"# Extracted text from {pdf_path.name}\n\n")
        out.write("Generated with Gemini Vision (page-by-page).\n")

        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            png_bytes = render_page_png_bytes(page, scale)

            prompt = (
                "Extract all text from this scanned page. "
                "Return Markdown, preserving headings, numbering, and tables as best as possible. "
                "Do not add commentary."
            )

            content = [
                prompt,
                genai.types.Part.from_bytes(data=png_bytes, mime_type="image/png"),
            ]

            try:
                response = client.models.generate_content(model=model, contents=content)
                page_text = (response.text or "").strip()
            except Exception as exc:
                page_text = f"[ERROR] Page {page_index + 1}: {exc}"

            out.write("\n\n")
            out.write(f"--- Page {page_index + 1} ---\n\n")
            out.write(page_text)
            out.flush()

            print(f"Processed page {page_index + 1}/{doc.page_count}")

    print(f"Done. Output: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
