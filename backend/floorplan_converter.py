"""
floorplan_converter.py

Utility functions to convert PDF floorplans into PNG images and log the results.
"""
import os
import fitz
from rich.console import Console
from rich.panel import Panel
from pathlib import Path

console = Console()

# Directory containing source PDF floorplans
PDF_DIR = "./data/floorplans"
# Directory to save generated PNG images
PDF_IMG_DIR = "./data/floorplans_images"

# ---------- Print saved images to terminal in a styled way --------------

def log_saved_files(paths: list[str]) -> None:
    """
    Display a list of saved files in a styled panel using Rich.

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


# ---------- Convert each page in PDF to one PNG image --------------

def convert_floorplan_pdfs():
    """
    Convert all PDF files in the source directory to PNG images and save them.

    - Scans the PDF_DIR directory for PDF files.
    - Converts each page of every PDF to a PNG image.
    - Saves these images to the PDF_IMG_DIR directory.
    - After processing each PDF, logs the saved images using `log_saved_files`.
    """
    # Ensure the output directory exists
    os.makedirs(PDF_IMG_DIR, exist_ok=True)

    # Iterate over all files in the PDF directory
    for pdf_file in os.listdir(PDF_DIR):
        # Skip non-PDF files
        if not pdf_file.lower().endswith(".pdf"): 
            continue

        path = os.path.join(PDF_DIR, pdf_file)

        # Open the PDF document
        doc = fitz.open(path)
        base = os.path.splitext(pdf_file)[0]
        img_paths = []
        # Convert each page to a PNG image
        for page_num, page in enumerate(doc):
            pix = page.get_pixmap()
            img_path = os.path.join(PDF_IMG_DIR, f"{base}_page{page_num+1}.png")
            pix.save(img_path)
            img_paths.append(img_path)

        doc.close()
        # Log the saved image files
        log_saved_files(img_paths)


# ---------- Main entry point for this script --------------

if __name__ == "__main__":
    convert_floorplan_pdfs()