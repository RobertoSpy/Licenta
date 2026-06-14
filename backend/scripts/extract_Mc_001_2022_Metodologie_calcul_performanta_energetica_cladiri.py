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
        else Path(__file__).resolve().parents[1] / "docsAI" / "Mc-001-2022-Metodologie-calcul-performanta-energetica-cladiri.pdf"
    )
    output_path = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[1] / "docsAI" / "Mc-001-2022-Metodologie-calcul-performanta-energetica-cladiri.md"
    )

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}")
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / ".env"

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and env_path.exists():
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
    scale = float(os.environ.get("GEMINI_PDF_SCALE", "3.0"))

    client = genai.Client(api_key=api_key)
    doc = fitz.open(pdf_path)

    start_page = 0
    file_mode = "w"
    
    if output_path.exists():
        content = output_path.read_text(encoding="utf-8")
        import re
        matches = re.findall(r"--- Page (\d+) ---", content)
        if matches:
            last_page = int(matches[-1])
            start_page = last_page
            file_mode = "a"
            print(f"Resuming from page {start_page + 1}...")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open(file_mode, encoding="utf-8") as out:
        if file_mode == "w":
            out.write(f"# Extracted text from {pdf_path.name}\n\n")
            out.write("Generated with Gemini Vision (page-by-page).\n")

        prompt = (
            "This is a scanned page from a Romanian technical construction normative (normativ tehnic). "
            "Extract ALL text exactly as it appears. "
            "Rules:\n"
            "- Preserve Romanian diacritics exactly: ă, â, î, ș, ț (use comma-below variants: ș ț, NOT cedilla: ş ţ)\n"
            "- Preserve all headings with their numbering (e.g. '3.1.2.', 'Art. 5', 'CAPITOLUL IV')\n"
            "- Preserve tables using Markdown table syntax\n"
            "- Preserve mathematical formulas as plain text (e.g. 'G <= GN', 'Tsi > theta_r')\n"
            "- If text is blurry or unclear, write [UNCLEAR] instead of guessing\n"
            "- Do NOT paraphrase, summarize, or add any commentary\n"
            "- Do NOT invent values, numbers, or article references you cannot clearly read\n"
            "Return only the extracted Markdown text, nothing else."
        )

        for page_index in range(start_page, doc.page_count):
            page = doc.load_page(page_index)
            png_bytes = render_page_png_bytes(page, scale)

            content = [
                prompt,
                genai.types.Part.from_bytes(data=png_bytes, mime_type="image/png"),
            ]

            retries = 0
            while retries < 5:
                try:
                    import time
                    time.sleep(2)
                    response = client.models.generate_content(model=model, contents=content)
                    page_text = (response.text or "").strip()
                    break
                except Exception as exc:
                    err_msg = str(exc)
                    if "429" in err_msg or "503" in err_msg or "Quota" in err_msg or "unavailable" in err_msg.lower():
                        retries += 1
                        print(f"  [WARN] Page {page_index + 1}: Rate limit or unavailable ({exc}). Retrying in {retries * 5}s...")
                        import time
                        time.sleep(retries * 5)
                    else:
                        page_text = f"[ERROR] Page {page_index + 1}: {exc}"
                        break
            
            if retries == 5:
                page_text = f"[ERROR] Page {page_index + 1}: Max retries exceeded due to quota/rate limit."

            out.write("\n\n")
            out.write(f"--- Page {page_index + 1} ---\n\n")
            out.write(page_text)
            out.flush()

            print(f"Processed page {page_index + 1}/{doc.page_count}")

    print(f"Done. Output: {output_path}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
