"""
room_finder.py

Helper functions to get highlight the room on the matching PDF.
"""
import schedule_parser as sched_parser

from rapidfuzz import process, fuzz
from rich.console import Console
import fitz

console = Console()

# ---------- Get the best matching building name --------------

def best_match_building_name(target_name: str, possible_choices: list[str]) -> str:
    """
    Use fuzzy matching to find the closest match of the official building name
    inside the list of extracted text from the PDF.

    Args:
        target_name (str): The WWU building name (e.g. "Communications Facility").
        possible_choices (list[str]): Possible building names. 

    Returns:
        str: Best matched name from the extracted lines, or the original if no good match found.
    """
    candidates = [line.strip().lower() for line in possible_choices if line.strip()]
    target = target_name.strip().lower()

    match = process.extractOne(target, candidates, scorer=fuzz.WRatio)
    return match[0].title() if match and match[1] >= 70 else target_name


# ---------- Highlight the room number on the matched PDF --------------

def highlight_room_on_floorplan(pdf_path: str, room_num: str, output_path: str, padding: float = 16.0, border_width : float = 2.0) -> None:
    """
    Searches for a specific room label (text) in a PDF, highlights it with a colored box,
    and saves a new single-page PDF showing only the page with the match.

    Args:
        pdf_path (str): Path to the input PDF file to search.
        room_num (str): Text string to search for (e.g.,"110").
        output_path (str): Path to save the resulting one-page highlighted PDF.
        padding (float, optional): Extra padding around the text bounding box (in points). Default is 16.0.
        border_width (float, optional): Thickness of the red border (in points). Default is 2.0.

    Returns:
        None: The function saves the PDF to `output_path` and prints success/failure via `console`.
              If the room label is not found, no file is saved.
    """
    doc = fitz.open(pdf_path)
    for page_num, page in enumerate(doc):
        text_instances = page.search_for(room_num)

        if text_instances:
            # copy the matched pdf for highlight
            out_doc = fitz.open()
            new_page = out_doc.new_page(width=page.rect.width, height=page.rect.height)
            new_page.show_pdf_page(page.rect, doc, page_num)
            # get first matched coordinates
            coordinates = text_instances[0]
            x0, y0, x1, y1 = coordinates
            expanded_rect = fitz.Rect(x0-padding, y0-padding, x1+padding, y1+padding)
            # set the highlighted square
            highlight = new_page.add_rect_annot(expanded_rect)
            highlight.set_colors(stroke=(1, 0, 0), fill=(1, 1, 0))
            highlight.set_border(width=border_width)
            highlight.set_opacity(0.7)
            highlight.update()
            # save the highlighted pdf to output_path
            out_doc.save(output_path)
            console.print(f"[green]✓ Saved[/] [red]room {room_num}[/] [green]highlighted PDF[/]: [cyan]{output_path}[/]")
            # close for better practice
            out_doc.close()
            doc.close()
            return
    
    console.print(f"[red] NO match for[/] [cyan]room {room_num}[/]")
    doc.close()


# ---------- Main class for this python file --------------

if __name__ == "__main__":
    path = "./data/floorplans/CF.pdf"
    room_num = "015"

    extracted_lines = sched_parser.extract_raw_text_from_pdf(path, page_number=0)
    prv_name = "Communications facility"
    building_name = best_match_building_name(prv_name, extracted_lines)
    console.print(f"\n[bold red]BEST MATCH[/] --> [bold green]{prv_name}[/]: [yellow]{building_name}[/]\n")


