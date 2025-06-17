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

# better printing style
console = Console()

# links to download the floor plan
START_URL = "https://fdo.wwu.edu/campus-floor-plans"
# help solve relative link to download correctly
BASE_URL = "https://fdo.wwu.edu"
# directory to save the pdf
OUTPUT_DIR = "floorplans"

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

def parse_pdf_links(html: str, base_url: str) -> set[str]:
    """
    Get all links to PDFs at current page.

    Args:
        html (str): The HTML content of the page as a string.
        base_url (str): The base URL used to resolve relative PDF links.

    Returns:
        pdf_links (set(str)): A sorted set of absolute URLs pointing to PDF files found in the HTML.

    """
    sp = BeautifulSoup(html, "html.parser")
    pdf_links = set()

    # search for element that have 'a' tag with href attribute
    for link in sp.find_all('a', href=True):
        href = link["href"]
        # ensure the link is to download the pdf floor plan
        if href.lower().endswith(".pdf"):
            full_url = urljoin(base_url, href)
            pdf_links.add(full_url)
    # ensure in sorted order
    return sorted(pdf_links)

def download_file(url: str, dest_folder: str) -> None:
    """
    Download a PDF from url to dest_folder

    - If the file already exists, the function skips downloading and prints a message.
    - Displays a Rich progress bar during download for visual.
    - Handles streaming download efficiently.

    Args:
        url (str): The URL of the PDF file to download.
        dest_folder (str): The local folder where the file should be saved.

    Returns:
        None
    """
    local_fn = os.path.basename(urlparse(url).path)
    dest_path = os.path.join(dest_folder, local_fn)

    # return if already downloaded to dest_folder
    if os.path.exists(dest_path):
        console.print(f"[green]Already downloaded: [/green] {local_fn}")
        return
    
    with requests.get(url, stream=True) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        # progress bar
        with open(dest_path, "wb") as f:
            with Progress(
                "[progress.description]{task.description}",
                BarColumn(bar_width=None), 
                DownloadColumn(),
                TransferSpeedColumn(), 
                TimeRemainingColumn(), 
                console=console
            ) as progress:
                task = progress.add_task(f"[cyan]Downloading[/] {local_fn}", total=total)
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        progress.update(task, advance=len(chunk))

    # download confirmation
    console.print(f"[bold green]✓ Downloaded:[/bold green] {local_fn}")

if __name__ == "__main__":
    console.print(f"\n[green]Get[/] floor plan page: {START_URL}")
    html = get_page(START_URL)
    console.print("[cyan]🔍 Parsing links to PDF floor plans ...[/cyan]")
    pdf_urls = parse_pdf_links(html, BASE_URL)

    if not pdf_urls:
        console.print(f"[red]No PDF available to download.[/red]")
        sys.exit(1)
    
    create_if_need_dir(OUTPUT_DIR)
    console.print(f"[bold cyan]📄 Found {len(pdf_urls)} PDF(s)[/bold cyan]")
    console.print(f"[green]⬇ Downloading into:[/green] [yellow]{OUTPUT_DIR}/[/yellow]\n")

    for url in pdf_urls:
        try:
            download_file(url, OUTPUT_DIR)
        except Exception as e:
            console.print(f"[red]Failed to download[/] {url} : {e}")
            sys.exit(1)
    
    console.print(f"\n[green]All done![/]")
