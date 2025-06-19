import os
import fitz
from rich.console import Console
from rich.panel import Panel
from pathlib import Path

console = Console()

PDF_DIR = "./data/floorplans"
PDF_IMG_DIR = "./data/floorplans_images"

# ---------- Print saved images to terminal in a styled way --------------

def log_saved_files(paths: list[str]) -> None:
    """
    Display a list of saved file in a styled panel using Rich.

    Args:
        paths (list[str]): List of file paths that were saved.
    
    Returns:
        None
    """
    body = "\n".join(
        f"[bold green]💾 Saved[/bold green] [cyan]{Path(p).name}[/cyan]"
        for p in paths
    )
    panel = Panel(body, title="Files Saved", title_align="left", border_style="bold blue")
    console.print(panel)


# ---------- Conver each page in PDF to be one PNG --------------

def convert_floorplan_pdfs():
    """
    Convert all PDF files in a source directory to PNG images and save them.
        - Scans the PDF_DIR directory for PDF files, converts each page to a PNG image, 
        and saves these images to the PDF_IMG_DIR directory. After processing each PDF, 
        it logs the saved images using `log_saved_files`.
    """
    os.makedirs(PDF_IMG_DIR, exist_ok=True)

    for pdf_file in os.listdir(PDF_DIR):
        if not pdf_file.lower().endswith(".pdf"): 
            continue

        path = os.path.join(PDF_DIR, pdf_file)

        doc = fitz.open(path)
        base = os.path.splitext(pdf_file)[0]
        img_paths = []
        for page_num, page in enumerate(doc):
            pix = page.get_pixmap()
            img_path = os.path.join(PDF_IMG_DIR, f"{base}_page{page_num+1}.png")
            pix.save(img_path)
            img_paths.append(img_path)

        doc.close()
        log_saved_files(img_paths)


# ---------- Main class for this python file --------------

if __name__ == "__main__":
    convert_floorplan_pdfs()