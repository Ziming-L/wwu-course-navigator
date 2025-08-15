"""
WWU Course Navigator Backend (Flask App)
----------------------------------------
This file implements the backend server for the WWU Course Navigator application.
It handles PDF schedule uploads, manual course entry, session-based temporary data,
and serves frontend/static files and floorplans. The backend uses Flask, supports CORS,
and provides REST endpoints for schedule parsing and resource management.

Author: Ziming L.
Last updated: August 2025
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import shutil
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from schedule_parser import extract_raw_text_from_pdf, process_parser_for_schedule
import atexit

console = Console()

# --- Paths ---
PROJECT_ROOT      = Path(__file__).parent.resolve().parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
BASE_TEMP_DIR = PROJECT_ROOT / "temporary_data"

# --- App setup ---
app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

def user_dirs():
    """
    Determines the temporary and floorplan directories for the current user session.
    Uses the X-Tab-ID header if present, otherwise falls back to the remote address.
    Ensures the directories exist.

    Returns:
        tuple: (user_temp, user_floor) as Path objects
    """
    tab_id = request.headers.get('X-Tab-ID')
    if not tab_id:
        tab_id = request.remote_addr

    user_temp = BASE_TEMP_DIR / tab_id
    user_floor = user_temp / 'floorplans'
    os.makedirs(user_floor, exist_ok=True)
    return user_temp, user_floor

def remove_temporary_data():
    """
    Deletes the entire temporary_data directory and prints a message to the console.
    Used for cleanup on server shutdown.
    """
    if BASE_TEMP_DIR.exists():
        shutil.rmtree(BASE_TEMP_DIR)
        print()
        console.print(Panel.fit(
            f"[red]🧹 Cleaned up [underline]temporary_data[/] on shutdown[/]",
            border_style="red",
        ))

atexit.register(remove_temporary_data)

@app.route("/cleanup/<tab_id>", methods=["POST"])
def cleanup(tab_id):
    """
    Endpoint to clean up a user's temporary data directory.
    Deletes the user's temp directory and, if empty, the main temp directory as well.
    Returns a JSON status message.
    """
    try:
        user_temp = BASE_TEMP_DIR / tab_id
        # delete if user temporary_data exists
        if user_temp.exists():
            shutil.rmtree(user_temp)
            # delete the main directory if empty
            if not any(BASE_TEMP_DIR.iterdir()):
                remove_temporary_data()

            console.print(Panel.fit(
                "[bold red]🗑️ Temporary Data Cleaned Up[/bold red]\n"
                f"[cyan]Deleted:[/cyan] [underline]./temporary_data/{tab_id}[/underline]",
                border_style="red",
            ))
        
        return jsonify({"status" : "ok"}), 200
    except Exception as e:
        return jsonify({"error" : str(e)}), 500

@app.route("/")
def index():
    """
    Serves the main frontend index.html file.
    """
    return app.send_static_file("index.html")

@app.route("/parse_schedule", methods=["POST"])
def parse_schedule():
    """
    Endpoint to handle schedule PDF uploads.
    Saves the uploaded PDF, extracts raw text, parses the schedule, and returns the parsed data as JSON.
    On error, returns a JSON error message.
    """
    user_temp, user_floor = user_dirs()
    schedule_path = user_temp / "schedule.pdf"
    output_json = user_temp / "schedule_parsed.json"

    try:
        f = request.files.get("file")
        if not f or not f.filename.lower().endswith(".pdf"):
            return jsonify({"error" : "Please upload a PDF"}), 400

        os.makedirs(os.path.dirname(schedule_path), exist_ok=True)
        f.save(schedule_path)

        raw_texts = extract_raw_text_from_pdf(schedule_path)

        sched = process_parser_for_schedule(
            raw_texts, 
            user_floor,
            output_json,
            print=False
        )
        relative_path = schedule_path.relative_to(PROJECT_ROOT)
        console.print(Panel.fit(
            "[bold yellow]📄 Schedule Loaded[/bold yellow]\n"
            f"[cyan]Saved to:[/cyan] [underline]{relative_path}[/underline]",
            border_style="yellow",
        ))
        return jsonify(sched), 200
    except Exception as e:
        app.logger.exception("Error in parse_schedule")
        return jsonify({"error" : str(e)}), 500

@app.route("/parse_text", methods=["POST"])
def parse_text():
    """
    Endpoint to handle manual course entry submissions.
    Converts the entries into a raw text format, parses the schedule, and returns the parsed data as JSON.
    On error, returns a JSON error message.
    """
    user_temp, user_floor = user_dirs()
    output_json = user_temp / "schedule_parsed.json"
    data = request.get_json() or {}
    entries = data.get("entries", [])

    raw_text = []
    for e in entries:
        raw_text.append(e["courseName"].title())
        raw_text.append(f"{e['courseCode'].upper()} {e['courseSection']}")
        raw_text.append(str(e["creditHours"]))
        raw_text.append(str(e["crn"]))
        raw_text.append(f"{e['startDate']} - {e['endDate']}")
        raw_text.append(", ".join(e["days"]))
        raw_text.append(f"{e['startTime']} - {e['endTime']}")
        raw_text.append(e["location"])
        raw_text.append(e["instructor"])

    try:
        sched = process_parser_for_schedule(
            raw_text, 
            floorplan_out_dir=user_floor,
            output_json=output_json,
            print=False
        )
        console.print(Panel.fit(
            "[bold yellow]📄 Schedule Loaded by Manual Input[/bold yellow]",
            border_style="yellow",
        ))
        return jsonify(sched), 200
    except Exception as e:
        app.logger.exception("Error in parse_text")
        return jsonify({"error" : str(e)}), 500

@app.route("/<tab_id>/floorplans/<path:filename>")
def serve_floorplan(tab_id, filename):
    """
    Serves a floorplan PDF for a given user session and filename.
    """
    user_temp = BASE_TEMP_DIR / tab_id
    user_floor = user_temp / 'floorplans'
    return send_from_directory(str(user_floor), filename)

@app.route("/data/<path:filename>")
def data_files(filename):
    """
    Serves static data files (e.g., building maps, JSON) from the data directory.
    """
    json_path = PROJECT_ROOT / 'data'
    return send_from_directory(json_path, filename)

@app.route("/<tab_id>/schedule.pdf")
def get_schedule_pdf(tab_id):
    """
    Serves the uploaded schedule PDF for a given user session.
    """
    user_temp = BASE_TEMP_DIR / tab_id
    return send_from_directory(directory=str(user_temp), path='schedule.pdf', as_attachment=False)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5500))
    console.print(Panel.fit(
        "[bold green]🗄️  Server Running[/bold green]\n"
        f"[cyan]Visit:[/cyan] [underline]http://127.0.0.1:{port}[/underline]",
        border_style="green"
    ))
    app.run(host='0.0.0.0', port=port)
