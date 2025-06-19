"""
download_floorplans.py

Get the WWU Campus floor plans page and download every PDF into a local 'floorplans/' folder
"""
import os
import sys
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from rich.progress import Progress, BarColumn, DownloadColumn, TransferSpeedColumn, TimeRemainingColumn
from rich.console import Console
import json

# better printing style
console = Console()

# links to download the floor plan
START_URL = "https://fdo.wwu.edu/campus-floor-plans"
# help solve relative link to download correctly
BASE_URL = "https://fdo.wwu.edu"
# directory to save the pdf
OUTPUT_DIR = "./data/floorplans"
# json file containing the building name to PDF location
MAPPING_FILE = "./data/building_map.json"

# ---------- Create directory if needed --------------

def create_if_need_dir(path: str) -> None:
    """
    Create directory if does not exist.

    Args:
        path (str): path to local directory.
    Returns:
        None
    """
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)


# ---------- Get the page specified by the 'url' --------------

def get_page(url: str) -> str:
    """
    Get the url page.

    Args:
        url (str): url link.
    Returns:
        str: The response body as a string (HTML/text) if the request is successful.
    Raises:
        SystemExit: If a network or HTTP error occurs,
            prints a colored error message using Rich and exits the program.
    """
    try:
        resp = requests.get(url)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        console.print(f"[red]Failed to get: [/red] {url} : {e}")
        sys.exit(1)


# ---------- Get the PDF links in the html --------------

def parse_pdf_links(html: str, base_url: str) -> list[tuple[str, str]]:
    """
    Get all links to PDFs at current page.

    Args:
        html (str): The HTML content of the page as a string.
        base_url (str): The base URL used to resolve relative PDF links.

    Returns:
        pdf_links (list[tuple[str, str]]): A sorted list (ex: building_name, url) of tuple of building name and absolute URLs pointing to PDF files found in the HTML.

    """
    sp = BeautifulSoup(html, "html.parser")
    pdf_links = []

    # search for element that have 'a' tag with href attribute
    for link in sp.find_all('a', href=True):
        href = link["href"]
        # ensure the link is to download the pdf floor plan
        if href.lower().endswith(".pdf"):
            full_url = urljoin(base_url, href)
            # building name or base name of URL
            building_name = link.get_text(strip=True)
            pdf_links.append((building_name, full_url))
    # ensure in sorted order
    return sorted(pdf_links, key=lambda x : x[0])


# ---------- Download a single PDF for each call --------------

def download_file(building_name: str, url: str, dest_folder: str) -> tuple[str, str]:
    """
    Download a PDF from url to dest_folder

    - If the file already exists, the function skips downloading and prints a message.
    - Displays a Rich progress bar during download for visual.
    - Handles streaming download efficiently.

    Args:
        building_name (str): Building name
        url (str): The URL of the PDF file to download.
        dest_folder (str): The local folder where the file should be saved.

    Returns:
        building name and local filename as (tuple[building_name, local_fn])
    """
    local_fn = os.path.basename(urlparse(url).path)
    dest_path = os.path.join(dest_folder, local_fn)

    if not os.path.exists(dest_path):
        with requests.get(url, stream=True) as reqs:
            reqs.raise_for_status()
            total = int(reqs.headers.get('content-length', 0))

            with open(dest_path, 'wb') as f, Progress(
                "[progress.description]{task.description}", 
                BarColumn(bar_width=None),
                DownloadColumn(), 
                TransferSpeedColumn(), 
                TimeRemainingColumn(), 
                console=console
            ) as prog:
                task = prog.add_task(f"[cyan]Downloading[/] {building_name}: {local_fn}", total=total)
                for chunk in reqs.iter_content(8192):
                    if chunk:
                        f.write(chunk)
                        prog.update(task, advance=len(chunk))

        console.print(f"[bold green]✓ Downloaded:[/bold green] {local_fn}")
    else:
        console.print(f"[green]Skipped (exists):[/green] {local_fn}")

    return building_name, local_fn


# ---------- Download and process all floorplans --------------

def download_and_process_floorplans():
    """
    Download and process the floor plans from WWU website
        1. Get the page from URL
        2. Get the links to download the PDFs: check if there are links
        3. Create a directory if does not exists
        4. Create a dictionary that contain the building name mapped to corresponding pdf files
        5. Create a JSON file to hold above dictionary
    """
    console.print(f"\n[green]Get[/] floor plan page: {START_URL}")
    html = get_page(START_URL)

    console.print("[cyan]🔍 Parsing links to PDF floor plans ...[/cyan]")
    pdf_links = parse_pdf_links(html, BASE_URL)

    if not pdf_links:
        console.print(f"[red]No PDF available to download.[/red]")
        sys.exit(1)
    
    create_if_need_dir(OUTPUT_DIR)
    console.print(f"[bold cyan]📄 Found {len(pdf_links)} PDF(s)[/bold cyan]")
    console.print(f"[green]⬇ Downloading into:[/green] [yellow]{OUTPUT_DIR}/[/yellow]\n")
    
    building_map = dict(
        download_file(name, url, OUTPUT_DIR) for name, url in pdf_links
    )

    with open(MAPPING_FILE, 'w') as f:
        json.dump(building_map, f, indent=2, sort_keys=True)

    console.print(f"\n[bold green]✓ Mapping saved to:[/bold green] {MAPPING_FILE}")
    console.print(f"\n[green]All done![/]")


# ---------- Main class for this python file --------------

if __name__ == "__main__":  
    download_and_process_floorplans()