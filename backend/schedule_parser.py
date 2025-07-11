"""
schedule_parser.py

Get the text from schedule pdf and highlighted rooms to put it into a JSON file in temporary_data
    - temporary_data: a temporary directory to be deleted for each user for privacy after finish
"""
import room_finder

import os.path
import fitz
import re
import json
import os
from pathlib import Path
from collections import defaultdict
from rich.console import Console
from rich.panel import Panel
from datetime import datetime
from typing import Optional

console = Console()

# change below path by user file
PDF_PATH = "./temporary_data/schedule.pdf"
OUTPUT_SCHEDULE_JSON = "./temporary_data/schedule_parsed.json"
BUILDING_MAP_JSON = "./data/building_map_with_coords.json"
BUILDING_FLOORPLAN_DIR = "./data/floorplans"
FLOORPLAN_OUT_DIR = "./temporary_data/floorplans"

# ---------- Extract text from fiven PDF --------------

def extract_lines_from_page(page: str) -> list[str]:
    """
    Helper to extracts text from a single fitz page and returns a list of non‑empty stripped lines.

    Args:
        page (str)
    
    Returns: 
        lines (list): text in list form
    """
    raw = page.get_text("text")
    return [ln.strip() for ln in raw.splitlines() if ln.strip()]


def extract_raw_text_from_pdf(pdf_path: str, page_number: Optional[int] = None) -> list[str]:
    """
    Open the file and return the text in a list form

    Args: 
        pdf_path (str): path to schedule pdf

    Returns:
        lines (list): text in list form
    """
    doc = fitz.open(pdf_path)

    if page_number is None:
        # all pages
        lines: list[str] = []
        for p in doc:
            lines.extend(extract_lines_from_page(p))
    else:
        # just the one page
        lines = extract_lines_from_page(doc[page_number])

    doc.close()
    return lines


# ---------- Parse schedule from text to dictionary for better access --------------

def parse_schedule_text(lines: str) -> dict:
    """
    Convert lines into a dictionary for each day that have courses info for that day

    Args: 
        lines (list): list of stripped lines from the PDF

    Returns: 
        ordered_schedule (dict): mapping full day names to lists of {course, time, building, room, instructor}
        -  Ordered by weekday and start time
    """
    schedule = defaultdict(list)
    # extra security on day check
    day_names = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    # improve search performance
    day_names_set = set(day_names)

    # find every index that is a course‐code line
    # code_pattern: find the course abbreviation - e.g., "MATH", "CS", "M/CS"
    code_pattern = re.compile(
        r'^[A-Z/]+(?:/[A-Z]+)?\s*'
        r'\d{3}[A-Z]?'
        r'\s+'
        r'[A-Z0-9]+$'
    )
    # code_indices: get the index from the list that contain the course code
    code_indices = [i for i, L in enumerate(lines) if code_pattern.match(L)]

    # meeting_date_pattern: from to end date - e.g., 09/27/2023 - 12/15/2023)
    meeting_date_pattern = re.compile(r'^\d{2}/\d{2}/\d{4}\s*-\s*\d{2}/\d{2}/\d{4}$')
    
    for idx in code_indices:
        # title: the line just above current idx
        title = lines[idx-1]
        code_sec = lines[idx]
        
        # parse course code (no trailing section number)
        # Ex: "CSCI 447 0" --> "CSCI 447"
        course_code = code_sec.rsplit(None, 1)[0]
        idx = idx + 1
        # skip credit hours and CRN
        # idx+1 --> credit
        # idx+2 --> CRN
        idx += 2
        
        # find the meeting block
        while idx < len(lines) and meeting_date_pattern.match(lines[idx]):            
            # idx --> date (Ex: "01/07/2025 - 03/21/2025")
            days_line     = lines[idx+1]
            time_line     = lines[idx+2]
            location_line = lines[idx+3]
        
            # find instructor name or next meeting date range
            peek = lines[idx+4].strip()
            if meeting_date_pattern.match(peek) or code_pattern.match(peek) or not peek:
                instructor = "Unknown Instructor"
                move_by = 4
            else:
                instructor = peek
                move_by = 5
            
            # skip lines
            idx += move_by
        
            # split out days (Ex: "Monday, Tuesday, Wednesday, Friday") 
            # into each element to a list (Ex: ["Monday", "Tuesday", "Wednesday", "Friday"])
            days = [d.strip() for d in days_line.split(',') if d.strip() in day_names_set]
            
            # pull building/room from the last two comma‐parts
            temp     = [p.strip() for p in location_line.split(',')]
            building = temp[-2]
            room     = temp[-1]
            
            # build the entry
            entry = {
                'course': f"{course_code} - {title}",
                'time':   time_line,
                'building': building,
                'room':    room, 
                'instructor' : instructor
            }
        
            # append to each day
            for d in days:
                schedule[d].append(entry)

    # helper to sort by start time
    def get_start_time(entry):
        try:
            time_str = entry['time'].split('-')[0].strip()
            return datetime.strptime(time_str, "%I:%M %p").time()
        except Exception:
            return datetime.strptime("11:59 PM", "%I:%M %p").time()  # fallback for bad format

    # sort by start time
    for day in schedule:
        schedule[day].sort(key=get_start_time)

    # sort by weekday order
    ordered_schedule = {day: schedule[day] for day in day_names if day in schedule}

    return ordered_schedule


# ---------- Print the schedule for better visual --------------

def print_schedule_weekday(sched: dict) -> None:
    """
    Print the schedule in better formal for visual

    Args: 
        sched (dict) : schedule in dictionary format
    
    Returns:
        None
    """
    for day, course_info in sched.items():
        console.print(f"\n[bold white on green] {day} [/]")
        for i in range(len(course_info)):
            info_line = course_info[i]
            for title, description in info_line.items():
                console.print(f"[bold magenta]{title}[/] : [bright_yellow]{description}[/]")
            print("\n")


# ---------- Create and add the highlighted PDF to schedule dictionary --------------

def load_building_map(path: str) -> dict[str, str]:
    """
    Load the JSON file.

    Args:
        path (str): JSON file path.
    
    Returns:
        JSON file (dict[str, str])
    """
    text = Path(path).read_text(encoding="utf-8")
    return json.loads(text)


def highlight_floorplans(sched: dict, floorplan_out_dir: str, print: bool = True) -> None:
    """
    Create the corresponding highlighted pdf for each course entry.

    For each entry in the weekly schedule:
      1. Resolve the raw building name against the official map.
      2. Skip entries for which no floorplan exists.
      3. Generate (once per building+room) a one‑page PDF with that room highlighted.
      4. Cache generated PDFs so that subsequent entries reuse the same file.
      5. Add a "map_pdf" field to each entry containing the output path (or "" if not found).

    Args:
        sched (dict): A mapping weekday → list of schedule entries, where each entry is a dict 
                        with at least "building" and "room" keys.
        floorplan_out_dir (str): floor plan output directory path. 
        print (bool): A flag to indicate if print to terminal.
        
    Returns:
        None: Mutates each entry in-place, setting entry["map_pdf"].
    """
    os.makedirs(floorplan_out_dir, exist_ok=True)
    # load the JSON from another directory
    building_map = load_building_map(BUILDING_MAP_JSON)
    official_names = list(building_map.keys())
    cache = {}

    # loop through all entries
    for entries in sched.values():
        for entry in entries:
            raw_name = entry["building"]
            room = entry["room"]

            # get the building name
            if raw_name in building_map:
                match_name = raw_name
            else:
                match_name = room_finder.best_match_building_name(raw_name, official_names)
                if print:
                    console.print(f"[yellow]⚠️  [magenta]NAME CHANGE:[/] '{raw_name}' --> '{match_name}'[/]")
            
            key = f"{match_name}_{room}"
            # reuse existing PDF if already exist
            if key in cache:
                cached_data = cache[key]
                entry["map_pdf"] = cached_data["map_pdf"]
                entry["lat"] = cached_data.get("lat")
                entry["lon"] = cached_data.get("lon")
                continue

            # get the floor plan PDF name
            building_data = building_map.get(match_name, {})
            pdf_filename = building_data.get("fileName")
            lat = building_data.get("lat")
            lon = building_data.get("lon")

            if not pdf_filename:
                console.print(f"[red]NO floorplan PDF for[/] [bold]{raw_name}[/]")
                entry["map_pdf"] = ""
                entry["lat"] = None
                entry["lon"] = None
                continue

            # compute the input and output file path
            in_pdf = Path(BUILDING_FLOORPLAN_DIR) / pdf_filename
            building_abbr = pdf_filename.replace(".pdf", "")
            out_pdf = os.path.join(
                floorplan_out_dir, 
                f"{building_abbr}_{room}.pdf"
            )

            # generate the highlighted PDF
            room_finder.highlight_room_on_floorplan(in_pdf, room, out_pdf)

            if os.path.exists(out_pdf):
                cache_data = {
                    "map_pdf": out_pdf, 
                    "lat" : lat, 
                    "lon" : lon
                }
                cache[key] = cache_data
                entry["map_pdf"] = out_pdf
            else:
                entry["map_pdf"] = ""
                entry["lat"] = None
                entry["lon"] = None


# ---------- Create a JSON file for schedule --------------

def create_sched_json(sched: dict, output_json: str) -> None:
    """
    Create the json file of the schedule dictionary

    Args:
        sched (dict): schedule dictionary
        output_json (str): full path to write the JSON file

    Returns:
        None
    """
    p = Path(output_json)
    p.parent.mkdir(parents=True, exist_ok=True)

    p.write_text(json.dumps(sched, indent=2), encoding="utf-8")
    
    console.print(Panel.fit(
        f"[bold green]✓ Schedule saved to:[/bold green] {output_json}",
        border_style="green"
    ))

# ---------- Run parser for schedule --------------

def process_parser_for_schedule(raw_text: list[str], floorplan_out_dir: str, output_json: str, print=True) -> dict:
    """
    Run the complete logic for parsing the schedule
        1. Parse it to a dictionary
        2. Create the corresponding highlighted room pdf
        3. Print schedule to terminal
        4. Create a JSON file to store the schedule

    Args:
        raw_text (list[str]): raw text extracted.
        floorplan_out_dir (str): floor plan output directory path.
        output_json (str): schedule output directory path. 
        print (bool) : default to be true to print to terminal. 
    
    Returns:
        sched (dict): extracted text into correct position in dictionary.
    """
    sched = parse_schedule_text(raw_text)
    if print:
        console.print(Panel.fit(f"[green]✓ Parsed schedule text[/]"))
    
    highlight_floorplans(sched, floorplan_out_dir, print)
    
    if print: 
        print_schedule_weekday(sched)

    """
    # print(sched)
    # print the lines in dictionary for schedule
    for i in sched:
        print(i, sched.get(i), "\n")
    """
    create_sched_json(sched, output_json)

    return sched


# ---------- Main class for this python file --------------

if __name__ == "__main__":
    raw_text = extract_raw_text_from_pdf(PDF_PATH)
    # get the list entries:
    """
    for i, L in enumerate(raw_text):
        print(i, ": ", L)
    """
    process_parser_for_schedule(
        raw_text, 
        FLOORPLAN_OUT_DIR, 
        OUTPUT_SCHEDULE_JSON, 
    )
