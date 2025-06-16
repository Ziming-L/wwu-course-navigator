import fitz
import re
from collections import defaultdict

PDF_PATH = "Ziming - Winter 2025.pdf"

def extract_raw_text_from_pdf(pdf_path: str) -> str:
    """
    Open the file and return the text in a list form

    Args: 
        pdf_path (str): path to schedule pdf

    Returns:
        lines (list): text in list form
    """
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text("text")

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return lines

def parse_schedule_text(lines: str) -> dict:
    """
    Convert lines into a dictionary for each day that have courses info for that day

    Args: 
        lines (list): list of stripped lines from the PDF

    Returns: 
        schedule (dict): mapping full day names to lists of {course, time, building, room, instructor}
    """
    schedule = defaultdict(list)
    # extra security on day check
    day_names = {'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'}
    
    # find every index that is a course‐code line
    # code_pattern: find the course abbreviation - e.g. "MATH", "CS", "M/CS"
    code_pattern = re.compile(r'^[A-Z/]+(?:/[A-Z]+)?\s*\d{3}[A-Z]?\s+\d+$')
    # code_indices: get the index from the list that contain the course code
    code_indices = [i for i, L in enumerate(lines) if code_pattern.match(L)]
    
    for idx in code_indices:
        # title: the line just above current idx
        title = lines[idx-1]
        code_sec = lines[idx]
        
        # parse course code (no trailing section number)
        # Ex: "CSCI 447 0" --> "CSCI 447"
        course_code = code_sec.rsplit(None, 1)[0]
        
        # lines below:
        # idx+1 --> credit
        # idx+2 --> CRN
        # idx+3 --> date (Ex: "01/07/2025 - 03/21/2025")
        days_line     = lines[idx+4]
        time_line     = lines[idx+5]
        location_line = lines[idx+6]
        instructor    = lines[idx+7]
        
        # split out days (Ex: "Monday, Tuesday, Wednesday, Friday") 
        # into each element to a list (Ex: ["Monday", "Tuesday", "Wednesday", "Friday"])
        days = [d.strip() for d in days_line.split(',') if d.strip() in day_names]
        
        # pull building/room from the last two comma‐parts
        temp = [p.strip() for p in location_line.split(',')]
        building = temp[-2]
        room     = temp[-1]
        
        # build the entry
        entry = {
            'course': f"{course_code} — {title}",
            'time':   time_line,
            'building': building,
            'room':    room, 
            'instructor' : instructor
        }
        
        # append to each day
        for d in days:
            schedule[d].append(entry)
    
    return dict(schedule)

raw_text = extract_raw_text_from_pdf(PDF_PATH)
# get the list entries:
"""
for i, L in enumerate(raw_text):
    print(i, ": ", L)
"""

sched = parse_schedule_text(raw_text)

# print the lines in dictionary for schedule
for i in sched:
    print(i, sched.get(i), "\n")
