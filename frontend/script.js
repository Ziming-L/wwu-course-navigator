/**
 * WWU Course Navigator Frontend Script
 * ------------------------------------
 * Handles all UI logic, event listeners, and communication with the backend server
 * for course schedule parsing, manual entry, and floorplan display.
 *
 * Author: Ziming L.
 * Last updated: August 2025
 */

// Holds the schedule JSON returned from the server
let scheduleData = {};
// Backend server location
const BACKEND = 'https://wwu-course-navigator.onrender.com';

// DOM element references for UI controls and containers
const toggleContainer = document.getElementById('themeToggle');
const toggleBtn  = document.getElementById('darkModeSwitch');
const icon = toggleBtn.querySelector('.theme-icon');
const label = toggleBtn.querySelector('.theme-label');
const fileInput = document.getElementById('fileInput');
const overlay = document.getElementById('overlay');
const fileNameSpan = document.getElementById('fileName');
const viewPdfIcon = document.getElementById('viewPdfIcon');
const pdfModal = document.getElementById('pdfModal');
const pdfFrame = document.getElementById('pdfFrame');
const openInstructionLink = document.getElementById('openInstructionLink');
const pdfModalClose = document.getElementById('pdfModalClose');
const loadBtn = document.getElementById('loadBtn');
const manualBtn = document.getElementById('manualInputBtn');
const dayButtons = document.querySelectorAll('#daySelect button[data-day]');
const classList = document.getElementById('classList');
const floorplanContainer = document.getElementById('floorplanContainer');
const clearTempBtn = document.getElementById('clearTempBtn');
const modal = document.getElementById('manualModal');
const viewResourcesBtn = document.getElementById('viewResourcesBtn');
const resourceModal = document.getElementById('resourcesModal');
const resourceItems = document.querySelectorAll('#resourcesModal ul li');
const exampleScheduleRow = document.getElementById('exampleScheduleRow');
const resourceList = document.querySelectorAll('#resourcesModal ul li.has-description');
const scheduleModal = document.getElementById('scheduleModal');
const closeScheduleModal = document.getElementById('closeScheduleModal');
const loadExampleScheduleBtn = document.getElementById('loadExampleScheduleBtn');
const closeBtn = document.getElementById('closeModal');
const addEntryBtn = document.getElementById('addEntryBtn');
const entriesContainer = document.getElementById('entriesContainer');
const saveCourseBtn = document.getElementById('saveCourses');

// Default values for each selected fields
const DEFAULTS = {
    courseName: 'unknown',
    courseCode: 'UNK 000',
    courseSection: '0',
    creditHours: '4',
    crn: '00000',
    instructor: 'unknown'
};

//-------------------------------------------------------
//                    Helper Functions                  |
//-------------------------------------------------------

/**
 * Highlights an input element if a condition is true, typically for validation feedback.
 * Optionally sets a flag object to true if highlighted (useful for batch validation).
 *
 * @param {boolean} condition - Whether to highlight the input (true = highlight, false = reset style).
 * @param {Element} input - The input DOM element to highlight or reset.
 */
function highlightIf(condition, input) {
    if (condition) {
        // Highlight the input with a red border for invalid/required fields
        input.style.border = '1px solid red';
        input.style.borderRadius = '4px';
    } else {
        // Reset the input border to default (valid state)
        input.style.border = '';
        input.style.borderWidth = '1px';
        input.style.borderRadius = '4px';
    }
}

/**
 * Format an ISO date into U.S. style date.
 * 
 * @param {string} isoDate - ISO-formatted date string.
 * @returns {string} Formatted date in "MM/DD/YYYY" or "".
 */
function formatDateMDY(isoDate) {
    // Guard against empty values
    if (!isoDate) return "";
    // isoDate is "YYYY-MM-DD"
    const [year, month, day] = isoDate.split("-");
    return `${month}/${day}/${year}`;
}

/**
 * Converts a 24-hour time string (HH:MM) to 12-hour format with AM/PM.
 * Displays an alert if the input is missing or invalid.
 *
 * @param {string} hhmm - Time string in HH:MM format (e.g., "13:45").
 * @returns {string} Time in 12-hour format with AM/PM (e.g., "01:45 PM").
 */
function to12Hour(hhmm) {
    // Validate input: must be a string containing a colon
    if (!hhmm || !hhmm.includes(':')) {
        showAlert("Missing or invalid time fields", false, () => {
            console.warn("Error in time fields.");
        });
    }
    // Split the input into hours and minutes, and convert to numbers
    let [h, m] = hhmm.split(':').map(Number);
    // Determine AM/PM suffix
    const suffix = h >= 12 ? 'PM' : 'AM';
    // Convert hour to 12-hour format (0 or 12 becomes 12)
    h = h % 12 || 12;
    // Pad hour and minute with leading zeros if needed
    const hh = h.toString().padStart(2, '0');
    // Return formatted string in 12-hour format
    return `${hh}:${m.toString().padStart(2,'0')} ${suffix}`;
}

/**
 * Validates that the end value is not before the start value for a pair of date or time inputs.
 * Highlights invalid fields and shows an alert if the range is invalid.
 *
 * @param {HTMLElement} startEl - The input element for the start value (date or time).
 * @param {HTMLElement} endEl - The input element for the end value (date or time).
 * @param {number} entryIdx - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if the range is valid, `false` otherwise.
 */
function validateRange(startEl, endEl, entryIdx) {
    // Determine the type of input (date or time)
    const type = startEl.type;
    let valid;

    if (type === 'date') {
        // For date inputs, convert values to Date objects and compare
        const start = new Date(startEl.value);
        const end = new Date(endEl.value);
        valid = end >= start;
    } else if (type === 'time') {
        // For time inputs, compare the string values directly ("HH:MM" format)
        valid = endEl.value >= startEl.value;
    } else {
        // If the input type is not recognized, show an alert and return false
        showAlert(
            'Incorrect html element passed!',
            false, 
            () => console.warn(`Acknowledged bad element passed`)
        );
        return false;
    }

    if (!valid) {
        // Highlight both fields as invalid
        highlightIf(true, startEl);
        highlightIf(true, endEl);

        // Build a user-friendly error message based on the type
        const errorType = type.charAt(0).toUpperCase() + type.slice(1) + ' error:';
        showAlert(
            `<strong>${errorType}</strong><br>
            <u>End ${type}</u> must be on or after the <u>start ${type}</u> in entry #${entryIdx + 1}.`,
            false, 
            () => console.warn(`Acknowledged bad ${type} range`)
        );
        return false;
    }
    // If valid, remove any highlight from the fields
    highlightIf(false, startEl);
    highlightIf(false, endEl);
    return true;
}

/**
 * Set the disabled and required state of an input field.
 *
 * @param {HTMLInputElement} field - The input field to update.
 * @param {boolean} disabled - Whether the field should be disabled.
 * @param {boolean} required - Whether the field should be required.
 */
function setFieldState(field, disabled, required) {
    field.disabled = disabled;
    field.required = required;
}

/**
 * Update a button's disabled state and label
 * 
 * @param {HTMLButtonElement} button - button to be changed
 * @param {string} label - text to be changed to
 * @param {boolean} disabled - Flag to indicate if disable the button or not
 */
function setButtonState(button, label, disabled = true) {
    button.disabled = disabled;
    button.textContent = label;
}

/**
 * Closes a modal when clicking outside its content area.
 * 
 * @param {HTMLElement} modalElement - The modal element to attach the handler to.
 */
function closeModalOnOutsideClick(modalElement) {
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
        }
    });
}

/**
 * Set the display and required state for building and room fields.
 *
 * @param {HTMLElement} buildingRow - The row element for the building input.
 * @param {HTMLElement} roomRow - The row element for the room input.
 * @param {HTMLInputElement} buildingInput - The building input element.
 * @param {HTMLInputElement} roomInput - The room input element.
 * @param {boolean} showAndRequire - If true, show rows and require inputs; if false, hide and not require.
 */
function setFieldVisibilityAndRequired(buildingRow, roomRow, buildingInput, roomInput, showAndRequire) {
    buildingRow.style.display = showAndRequire ? '' : 'none';
    roomRow.style.display = showAndRequire ? '' : 'none';
    buildingInput.required = showAndRequire;
    roomInput.required = showAndRequire;
}

/**
 * Displays a custom alert modal with a message, optional cancel button, and callback for user response.
 *
 * @param {string} message - The HTML message to display in the modal.
 * @param {boolean} withCancel - Whether to show a cancel button (true = show, false = hide).
 * @param {function} callback - Function called with true (OK) or false (Cancel) when the user responds.
 */
function showAlert(message, withCancel, callback) {
    // Get references to modal and its controls
    const modal = document.getElementById('customAlert');
    const msgEl = document.getElementById('alertMessage');
    const cancelBtn = document.getElementById('alertCancel');
    const okBtn = document.getElementById('alertOk');

    // Set the alert message (HTML allowed)
    msgEl.innerHTML = message;
    // Show or hide the cancel button based on withCancel flag
    cancelBtn.style.display = withCancel ? 'inline-block' : 'none';
    // Display the modal overlay
    modal.style.display = 'flex';

    // Cleanup function to hide modal and remove event listeners
    const cleanup = () => {
        modal.style.display = 'none';
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
    }

    // Handler for cancel button: cleanup and call callback with false
    const onCancel = () => {
        cleanup();
        callback(false);
    }

    // Handler for OK button: cleanup and call callback with true
    const onOk = () => {
        cleanup();
        callback(true);
    }

    // Attach event listeners for OK and Cancel buttons
    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
}

/**
 * Displays a confirmation dialog using showAlert and returns a Promise that resolves to the user's choice.
 *
 * @param {string} message - The message to display in the confirmation dialog.
 * @returns {Promise<boolean>} Resolves to true if OK is clicked, false if Cancel is clicked.
 */
function showConfirm(message) {
    return new Promise(resolve => {
        showAlert(message, true, confirmed => {
            console.log(
                confirmed 
                ? "Clicked OK for 'Clear Data'"
                : "Clicked Cancel for 'Clear Data'"
            );
            resolve(confirmed);
        });
    });
}

/**
 * Stops event propagation and optionally prevents the default browser behavior.
 * 
 * @param {Event} e - The event object.
 * @param {boolean} skipPreventDefault - [skipPreventDefault=false] if true, skip calling preventDefault().
 */
function halt(e, skipPreventDefault = false) {
    e.stopPropagation();
    if (!skipPreventDefault) {
        e.preventDefault();
    }
}

/**
 * Enables closing a modal when the user clicks outside its modal.
 * 
 * @param {HTMLElement} modalElement - The modal element to apply the outside-click close behavior to.
 */
function closeOnOutsideClick(modalElement) {
    if (!modalElement) return;
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
        }
    });
}

/**
 * Hide the schedule icon to the right of the filename box
 */
function hideScheduleIcon() {
    fileInput.value = '';
    fileNameSpan.textContent = 'No file chosen';
    viewPdfIcon.hidden = true;
    pdfFrame.src = '';
}

/**
 * Sends the validated course entries to the backend for parsing and updates the UI with the result.
 *
 * - Makes a POST request to the backend with the entries payload.
 * - Handles backend response, updates schedule data, and refreshes the UI.
 * - On error, shows an alert and logs the error.
 * 
 * @async async function
 * @param {Array<Object>} entries - Array of course entry objects to be parsed by the backend.
 */
async function parseEntries(entries) {
    try {
        // Send entries to backend for parsing
        const res = await fetch(`${BACKEND}/parse_text`, {
            method:  'POST',
            headers: { 'Content-Type':'application/json' },
            body:    JSON.stringify({ entries })
        });
        // Parse backend response as JSON
        const json = await res.json();
        if (!res.ok) {
            // If backend returns error, throw to trigger catch block
            throw new Error(json.error || res.statusText);
        }

        // Success: update UI with new schedule data
        hideScheduleIcon(); // Reset file input and PDF icon
        scheduleData = json; // Store new schedule data
        dayButtons.forEach(b => b.disabled = false); // Enable day buttons
        dayButtons[0].click(); // Show first day's schedule

        // Close manual entry modal and clear all entry blocks
        entriesContainer.innerHTML = '';
        modal.style.display = 'none';

    } catch (err) {
        // Show alert and log error if request fails
        showAlert('Failed to save courses: ' + err.message, false, () => {
            console.error('❌ Error in parse_text:', err);
        });
    }
}

/**
 * Loads and parses a JSON file from a given URL using fetch.
 * Throws an error if the request fails.
 *
 * @param {string} json_link - The URL or path to the JSON file to load.
 * @returns {Promise<Object>} The parsed JSON object from the response.
 * @throws {Error} If the fetch fails or the response is not OK.
 */
async function loadJSON(json_link) {
    // Fetch the JSON file from the provided link
    const resp = await fetch(json_link);
    // If the response is not OK, throw an error with status info
    if (!resp.ok) {
        throw new Error(`Failed to load JSON: ${resp.status} ${resp.statusText}`);
    }
    // Parse and return the JSON content
    return resp.json();
}

/**
 * Remove all child nodes from a DOM element, effectively clearing its contents.
 * 
 * @param {Element} el - The DOM element to be cleared.
 */
function clearEl(el) {
    // Loop and remove the first child until the element is empty
    while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Handles uploading and parsing a schedule PDF file.
 * - Validates file selection
 * - Sends the file to the backend for parsing
 * - Handles backend response and updates UI accordingly
 * - Enables day buttons and triggers default day selection
 */
async function loadSchedule() {
    console.log('[loadSchedule] clicked, files:', fileInput.files);
    // Ensure a file is selected before proceeding
    if (!fileInput.files.length) {
        showAlert('Please select a schedule PDF first.', false, () => {
            console.warn('... no file selected');
        });
        return;
    }
    // Indicate processing state on the load button
    setButtonState(loadBtn, 'Parsing ...', true);

    // Prepare form data for file upload
    const form = new FormData();
    form.append('file', fileInput.files[0]);

    // Send the PDF to the backend for parsing
    const res = await fetch(`${BACKEND}/parse_schedule`, {
        method: 'POST',
        body: form
    });
    const text = await res.text();
    let payload;

    // Attempt to parse the backend response as JSON
    try {
        payload = JSON.parse(text);
        console.log("✅ Schedule loaded");
    } catch {
        // Show error if response is not valid JSON
        showAlert('Server error - please check the console for details.', false, () => {
            console.error('Non-JSON response:', text);
        });
        setButtonState(loadBtn, 'Load Schedule', false);
        return;
    }

    // Handle backend error responses
    if (!res.ok) {
        showAlert('Error: ' + (payload.error || res.statusText), false, () => {
            console.log('Acknowledged error');
        });
        setButtonState(loadBtn, 'Load Schedule', false);
        return;
    }

    // Show the PDF icon if parsing succeeded
    if (payload) {
        viewPdfIcon.hidden = false;
    }

    // Store the parsed schedule data
    scheduleData = payload;

    // Enable all day buttons for navigation
    dayButtons.forEach(btn => {
        btn.disabled = false;
    });
    // Automatically select the first day (usually Monday)
    console.log("⤷ triggering default click on", dayButtons[0].dataset.day);
    dayButtons[0].click();
    // Reset the load button to its default state
    setButtonState(loadBtn, 'Load Schedule', false);
}

/**
 * Displays the list of classes for a given day and sets up click handlers for floor plan viewing.
 *
 * - Clears previous class and floorplan displays.
 * - Adds a header and populates the class list for the selected day.
 * - Handles both main campus and online classes, formatting each entry appropriately.
 * - Attaches click handlers to each class item to show the corresponding floor plan and highlight selection.
 *
 * @param {string} day - The day of the week to display classes for (e.g., 'Monday').
 */
function showDay(day) {
    console.log(`▶ showDay() |--> '${day}'`);
    // Clear previous class list and floorplan display
    clearEl(classList);
    clearEl(floorplanContainer);

    // Add a header above the class list
    const header = document.createElement('div');
    header.textContent = 'Click any class below to view its floor plan';
    header.classList.add('classListHeader');
    classList.appendChild(header);

    // Get the entries for the selected day, or an empty array if none
    const entries = scheduleData[day] || [];
    console.log('   entries for', day, entries);

    // If there are no classes scheduled, show a message and exit
    if (!entries.length) {
        classList.textContent = 'No classes scheduled.';
        classList.classList.add('no-classes');
        return;
    }
    classList.classList.remove('no-classes');

    // For each class entry, create a list item and set up click handler
    entries.forEach((entry, idx) => {
        const li = document.createElement('li');
        const hasUnknown = entry.course == 'UNK 000 - Unknown';
        const mainCampus = entry.campus === 'Main Campus';

        // Extract building name (remove abbreviation if present)
        let building = entry.building;
        if (building.includes('--')) {
            building = building.split('--')[0].trim();
        }

        // Build the display line for the class item
        let line = [`🕒 ${entry.time}`];

        if (mainCampus) {
            if (!hasUnknown) {
                line.push(`📚 ${entry.course}`);
            }
            line.push(`📍 ${building} ${entry.room}`);
        } else {
            if (!hasUnknown) {
                line.push(`📚 ${entry.course}`);
            }
            line.push(`🖥️ ${entry.campus} 🎓`);
        }
        li.textContent = line.join(' | ');

        // Set data attributes and class for styling/selection
        li.dataset.idx = idx;
        li.classList.add('class-item');
        classList.appendChild(li);

        // Attach click handler to show floorplan and highlight selection
        li.addEventListener('click', () => {
            console.log('⬤ li clicked:', entry);
            showFloorplan(mainCampus ? entry.map_pdf : '', entry.lat, entry.lon);
            classList.querySelectorAll('li').forEach(x => x.classList.remove('selected'));
            li.classList.add('selected');
        });
    });
}

/**
 * Creates and returns a configured iframe element for embedding content such as PDFs or maps.
 *
 * @param {string} src - The URL to load in the iframe.
 * @param {string} width - The width of the iframe (e.g., '100%').
 * @param {string} height - The height of the iframe (e.g., '600px').
 * @param {string} onloadMsg - Message to log on successful load (shown in console).
 * @param {string} onerrorMsg - Message to log on error (shown in console).
 * @param {Object} styleObj - Optional style object. If provided and contains a 'marginTop' property, 
 *                              it will be set on the iframe (e.g., { marginTop: '1rem' }).
 * @returns {HTMLIFrameElement} The configured iframe element, ready to be appended to the DOM.
 */
function createIframe(src, width, height, onloadMsg, onerrorMsg, styleObj = {}) {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = width;
    iframe.height = height;
    iframe.onload  = () => console.log(onloadMsg);
    iframe.onerror = e => console.error(onerrorMsg, e);
    // Only set marginTop if provided in styleObj
    if (styleObj && styleObj.marginTop) iframe.style.marginTop = styleObj.marginTop;
    return iframe;
}

/**
 * Displays a building floor plan PDF and, if available, a Google Maps location for the given coordinates.
 *
 * - Clears any previous floorplan/map display.
 * - Embeds the PDF in an iframe if a path is provided.
 * - If latitude and longitude are provided, also embeds a Google Maps iframe below the PDF.
 * - Handles missing data gracefully with user feedback and console warnings.
 *
 * @async async function.
 * @param {string} pdfPath - Path or filename of the floor plan PDF to display.
 * @param {number|null} lat - Latitude for the building location (if null, map is not shown).
 * @param {number|null} lon - Longitude for the building location (if null, map is not shown).
 */
async function showFloorplan(pdfPath, lat, lon) {
    // Remove any previous floorplan/map content
    clearEl(floorplanContainer);

    // If no PDF path is provided, show a fallback message and exit
    if (!pdfPath) {
        floorplanContainer.classList.add('no-floorplan');
        floorplanContainer.textContent = 'No floor plan available.';
        return;
    }

    // Ensure the container is styled for displaying a floorplan
    floorplanContainer.classList.remove('no-floorplan');

    // Extract the filename from the path and build the backend URL
    const fn = pdfPath.split('/').pop();
    const pdfUrl = `${BACKEND}/${tabId}/floorplans/${fn}`;

    console.log('[showFloorplan] → url:', pdfUrl);

    // check for server not responding
    try {
        const res = await fetch(pdfUrl, {method: 'HEAD'});
        if (!res.ok) {
            showAlert(`⚠️ Could not load floorplan (server returned ${res.status})
                <br>Please try again later.`, false, () => {
                console.warn("Acknowledged not loading floorplan");
            });
            return;
        }
    } catch (err) {
        showAlert(`❌ Cannot connect to server. Please try again later.`, false, () => {
            console.warn("Acknowledged not loading floorplan");
        });
        return;
    }

    // Create and configure the PDF iframe
    const pdfFrame = createIframe(
        pdfUrl,
        '100%',
        '600px',
        '✅ PDF loaded',
        '❌ PDF error',
    );
    floorplanContainer.appendChild(pdfFrame);

    // If coordinates are missing, skip the map and exit
    if (lat == null || lon == null) {
        console.warn('No coordinates provided; skipping map iframe');
        return;
    }

    // Create and configure the Google Maps iframe for the building location
    const mapFrame = createIframe(
        `https://www.google.com/maps?output=embed&q=${lat},${lon}&z=19&t=k&output=embed`,
        '100%',
        '500px',
        '✅ Map loaded',
        '❌ Map error',
        {marginTop:'1rem'}
    );
    floorplanContainer.appendChild(mapFrame);
}

/**
 * Returns an HTML string with step-by-step instructions for users to download their schedule PDF from myWestern.
 * The instructions include browser-specific steps for Chrome and Safari.
 *
 * @returns {string} HTML markup for the PDF download instructions modal.
 */
function createPdfInstructions() {
    // The returned string is HTML markup for the modal dialog
    return `
        <h2>Instruction to get PDF:</h2>
        <ol>
            <li>Click <a href="https://mywestern.wwu.edu/web4u" target="_blank" title="myWestern">
                here</a> and select \"Registration\".</li> <!-- Link to myWestern registration page -->
            <li>Log in with WWU username and password.</li>
            <li>Click \"<u>View Registration Information</u>\".</li>
            <li>Click on the dropdown to left of \"Term\" that is under \"Class Schedule\".</li>
            <li>Select the quarter you want to get the schedule PDF for.</li>
            <li>Click on the right upper corner (e.g. the printer icon \'🖨️\').</li>
            <li>Depending on web browser:</li>
            <details>
                <summary>Google Chrome</summary>
                <ol>
                    <li>Select the \"Destination\" dropdown and choose \"📄 Save as PDF\".</li>
                    <li>Click \"Save\" button.</li>
                    <li>Rename or keep it and click \"Save\" again.</li>
                </ol>
            </details>
            <details>
                <summary>Safari</summary>
                <ol>
                    <li>If popup doesn't appear, click on the left of the refresh icon (↻) on search bar.</li>
                    <li>Click \"PDF\" from the dropdown on the button left to the right of (?).</li>
                    <li>Rename or keep it and click \"Save\".</li>
                </ol>
            </details>
        </ol>
    `;
}

/**
 * Return a string of HTML to restrict only number.
 * 
 * @param {number} maxDigits - Maximum number of digits allowed.
 * @param {string} titleMsg - Title message.
 * @returns {string} String of HTML attributes for an <input> element.
 */
function numericInput(maxDigits = 5, titleMsg) {
    // Build a regex pattern string to allow only up to maxDigits digits (e.g., "\\d{1,5}")
    const pattern = `\\d{1, ${maxDigits}}`;
    
    return [
        `inputmode="numeric"`, // Use numeric keyboard on mobile devices
        `pattern="${pattern}"`, // HTML5 pattern for digit-only input of max length
        `title="${titleMsg}"`, // Tooltip for user guidance
        `onkeypress="if (!/[0-9]/.test(event.key)) event.preventDefault()"`, // Prevent non-digit keypresses
        `oninput="this.value = this.value.replace(/\\D/g, '').slice(0, ${maxDigits})"` // Remove non-digits and limit length
    ].join(' ');
}

/**
 * Generates the full HTML string for a course entry form block.
 * 
 * @param {string} uniqueId - A unique identifier used to distinguish input groups, especially for radio button `name` attributes and element IDs.
 * @returns {string} The full HTML markup string ready to inject into the DOM.
 */
function createCourseEntryHTML(uniqueId) {
    return `
        <button type="button" class="removeEntryBtn">✕</button>
        <div class="form-row">
            <label>Course Name<span class="required-star">*</span></label>
            <input type="text" class="courseName" placeholder="Elementary Linear Algebra" required title="Enter the course name">
        </div>
        <div class="form-row">
            <label>Course Code<span class="required-star">*</span></label>
            <input type="text" class="courseCode" placeholder="MATH 204" required title="Enter course code (e.g. MATH 204)">
        </div>
        <div class="form-row">
            <label>Section<span class="required-star">*</span></label>
            <input type="text" class="courseSection" placeholder="0" required title="Enter the section number">
        </div>
        <div class="form-row">
            <label>Credit Hours<span class="required-star">*</span></label>
            <input type="text" class="creditHours" placeholder="4" required maxlength="1" ${numericInput(1, "Enter up to 1 digit (e.g. 4)")}>
        </div>
        <div class="form-row">
            <label>CRN<span class="required-star">*</span></label>
            <input type="text" class="crn" placeholder="40699" required maxlength="5" ${numericInput(5, "Enter up to 5 digits (e.g. 40699)")}>
        </div>
            <div class="form-row">
            <label>Date Range<span class="required-star">*</span></label>
            <div class="range-group">
                <input type="date" class="startDate" required title="Choose a start date">
                <span class="separator">→</span>
                <input type="date" class="endDate" required title="Choose an end date">
            </div>
        </div>
        <div class="form-row">
            <label>Days<span class="required-star">*</span></label>
            <div class="days-checkboxes">
                <label><input type="checkbox" value="Monday" class="dayChk" checked> Monday\</label>
                <label><input type="checkbox" value="Tuesday" class="dayChk"> Tuesday</label>
                <label><input type="checkbox" value="Wednesday" class="dayChk"> Wednesday</label>
                <label><input type="checkbox" value="Thursday" class="dayChk"> Thursday</label>
                <label><input type="checkbox" value="Friday" class="dayChk"> Friday</label>
            </div>
        </div>
        <div class="form-row">
            <label>Time Range<span class="required-star">*</span></label>
            <div class="range-group">
                <input type="time" class="startTime" required title="Choose a start time">
                <span class="separator">→</span>
                <input type="time" class="endTime" required title="Choose an end time">
            </div>
        </div>
        <div class="form-row">
            <label>Campus<span class="required-star">*</span></label>
            <div class="campus-options">
                <label><input type="radio" name="${uniqueId}_campus" value="Main Campus" checked> Main Campus</label>
                <label><input type="radio" name="${uniqueId}_campus" value="Online"> Online</label>
            </div>
        </div>
        <div class="form-row">
            <label>Building<span class="required-star">*</span></label>
            <div class="building-container">
                <input type="text" id="building-input-${uniqueId}" class="building" placeholder="Bond Hall" required title="Enter or Select a building name">
                <div class="building-dropdown"></div>
            </div>
        </div>
        <div class="form-row">
            <label>Room<span class="required-star">*</span></label>
            <input type="text" class="room" placeholder="225" required maxlength="3" ${numericInput(3, "Enter the room number (e.g. 225)")}>
        </div>

        <div class="form-row">
            <label>Instructor<span class="required-star">*</span></label>
            <input type="text" class="instructor" placeholder="Ypma, Tjalling" required title="Enter the instructor name (e.g. last name, first name)">
        </div>
        <button type="button" class="applyDefaultsBtn">Set Floor Plan Defaults</button>
    `;
}

/**
 * Creates a dynamic course entry block for manual schedule input.
 *
 * This function generates a new DOM element containing all form fields for a single course entry,
 * including building autocomplete, validation, and campus/room logic. It wires up all event handlers
 * for dropdowns, validation, and default value toggling. The returned block is ready to be appended
 * to the entries container and fully interactive.
 *
 * @returns {HTMLDivElement} The DOM element representing the new course entry block, with all logic attached.
 */
function createEntryBlock() {
    // Generate a unique ID for this entry block (used for radio button grouping and element IDs)
    const uniqueId = 'entry_' + Math.random().toString(36).substring(2, 9);
    // Create the wrapper div for the entry
    const wrapper = document.createElement('div');
    wrapper.classList.add('entry');
    // Style the entry block for visual separation
    wrapper.style = "border:1px solid #ccc;padding:.75rem;margin:0.85rem 0;position:relative;display:flex;flex-direction:column;";
    // Inject the HTML for the course entry form
    wrapper.innerHTML = createCourseEntryHTML(uniqueId);
    // Get references to building input and dropdown
    const buildingInput = wrapper.querySelector(`#building-input-${uniqueId}`);
    const dropdown = wrapper.querySelector('.building-dropdown');
    // URL for building data
    const dataUrl = `${BACKEND}/data/building_map_with_coords.json`;
    let buildingList = [];

    // Fetch building data for dropdown autocomplete
    fetch(dataUrl)
        .then(r => r.json())
        .then(map => {
            // Map building data to {fullName, abbr} objects for search
            buildingList = Object.entries(map).map(([fullName, data]) => {
                const abbr = data.fileName.replace(/\.pdf$/i, '');
                return {fullName, abbr};
            });
        })
        .catch(err => {
            console.error('Could not lead building_map.json: ', err);
        })

    /**
     * Show dropdown of building options matching user input.
     */
    function showDropdown() {
        const query = buildingInput.value.toLowerCase(); // Get current input value
        dropdown.innerHTML = '';

        // Filter building list by name or abbreviation
        const filtered = buildingList.filter(b => 
            b.fullName.toLowerCase().includes(query) || b.abbr.toLowerCase().includes(query)
        );

        // Hide dropdown if no matches
        if (!filtered.length) {
            dropdown.classList.remove('show');
            return;
        }

        // Add each matching building as a dropdown option
        filtered.forEach(b => {
            const option = document.createElement('div');
            option.textContent = `${b.fullName} -- ${b.abbr}`;
            option.dataset.fullName = b.fullName;
            dropdown.appendChild(option);
        });

        dropdown.classList.add('show'); // Show dropdown
    }

    // Show dropdown on input or focus
    buildingInput.addEventListener('input', showDropdown);
    buildingInput.addEventListener('focus', showDropdown);

    // Handle click on dropdown option to select building
    dropdown.addEventListener('click', e => {
        if (e.target.dataset.fullName) {
            // Set input value to selected building
            buildingInput.value = `${e.target.dataset.fullName} -- ${e.target.textContent.split('--')[1].trim()}`;
            dropdown.classList.remove('show'); // Hide dropdown

            highlightIf(false, buildingInput); // Remove highlight if previously invalid
        }
    });

    // Hide dropdown if click occurs outside input or dropdown
    document.addEventListener('click', e => {
        const isInside = buildingInput.contains(e.target) || dropdown.contains(e.target);
        if (!isInside) {
            dropdown.classList.remove('show');
        }
    });

    // Add blur validation for all required inputs in this entry
    const inputs = wrapper.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            highlightIf(!input.value.trim(), input);
        });
    });

    // Remove entry block when remove button is clicked
    wrapper.querySelector('.removeEntryBtn').addEventListener('click', () => {
        entriesContainer.removeChild(wrapper);
    });

    // Handle "Set Floor Plan Defaults" and "Revert" logic
    const applyBtn = wrapper.querySelector('.applyDefaultsBtn');

    applyBtn.addEventListener('click', () => {
        // Selectors for fields to set defaults
        const fieldSelectors = [
            '.courseName',
            '.courseCode',
            '.courseSection',
            '.creditHours',
            '.crn',
            '.instructor'
        ];
        // Get all defaultable fields
        const fields = Array.from(wrapper.querySelectorAll(fieldSelectors.join(',')));
        // Get their parent rows for hiding/showing
        const rows = fields.map(f => f.closest('.form-row')).filter(r => r !== null);

        if (applyBtn.textContent === 'Set Floor Plan Defaults') {
            // Store original values for revert
            applyBtn._orig = {};
            fields.forEach(f => {
                applyBtn._orig[f.className] = f.value;
                if (DEFAULTS.hasOwnProperty(f.className)) {
                    f.value = DEFAULTS[f.className]; // Set default value
                }
                // Disable input and Not required when defaulted
                setFieldState(f, true, false);
                f.style.border = '';
            });
            // Hide the rows for defaulted fields
            rows.forEach(row => row.style.display = 'none');

            // Change button to 'Revert' mode
            applyBtn.textContent = 'Revert';
            applyBtn.classList.add('revert');
        } else {
            // Restore original values and re-enable fields
            const originals = applyBtn._orig || {};
            fields.forEach(f => {
                if (originals.hasOwnProperty(f.className)) {
                    f.value = originals[f.className];
                }
                // Enable input and required when defaulted
                setFieldState(f, false, true);
                f.onblur = () => highlightIf(!f.value.trim(), f);
            });
            rows.forEach(row => row.style.display = '');

            // Change button back to 'Set Floor Plan Defaults'
            applyBtn.textContent = 'Set Floor Plan Defaults';
            applyBtn.classList.remove('revert');
            delete applyBtn._orig;
        }
    });

    // Remove highlight from days-checkboxes if at least one day is checked
    wrapper.querySelectorAll('.dayChk').forEach(checkbox => {
        checkbox.addEventListener('change', e => {
            const container = e.target.closest('.days-checkboxes');
            if (container.querySelectorAll('.dayChk:checked').length > 0) {
                container.classList.remove('not-checked');
            }
        });
    });

    // Campus/room logic: hide/show building/room fields for Online campus
    const campusBuildingInput = wrapper.querySelector('.building');
    const campusRoomInput = wrapper.querySelector('.room');
    const buildingRow = campusBuildingInput.closest('.form-row');
    const roomRow = campusRoomInput.closest('.form-row');

    /** Store values for revert */
    let locationInfo = null;

    /**
     * Show/hide building/room fields based on campus selection
     */
    function updateCampusVisibility() {
        const checked = wrapper.querySelector(`input[name="${uniqueId}_campus"]:checked`);
        if (!checked) return;
        const selected = checked.value;

        if (selected === 'Online') {
            // Store current values
            locationInfo = {
                building: campusBuildingInput.value,
                roomNum: campusRoomInput.value,
            };
            // Set default values for online
            campusBuildingInput.value = 'Unknown Hall';
            campusRoomInput.value = '000';
            // Hide building/room fields
            setFieldVisibilityAndRequired(buildingRow, roomRow, campusBuildingInput, campusRoomInput, false);
        } else {
            // Restore previous values if available
            if (locationInfo) {
                campusBuildingInput.value = locationInfo.building;
                campusRoomInput.value = locationInfo.roomNum;
            } else {
                campusBuildingInput.value = '';
                campusRoomInput.value = '';
            }
            // Show building/room fields
            setFieldVisibilityAndRequired(buildingRow, roomRow, campusBuildingInput, campusRoomInput, true);
        }
    }

    // Listen for campus radio button changes
    const campusRadios = wrapper.querySelectorAll(`input[name="${uniqueId}_campus"]`);
    campusRadios.forEach(radio => radio.addEventListener('change', updateCampusVisibility));

    updateCampusVisibility(); // Set initial state

    return wrapper;
}

/**
 * Builds the payload array for all valid course entry blocks.
 *
 * @param {HTMLElement[]} entryDivs - Array of entry block elements (each representing a course form).
 * @returns {Array<Object>} Array of course entry objects ready for backend processing.
 */
function buildEntriesPayload(entryDivs) {
    return entryDivs.map(div => {
        // Extract all relevant field values for this entry
        const campus = div.querySelector('.campus-options input:checked').value;
        const room = div.querySelector('.room').value.trim();
        const building = div.querySelector('.building').value.trim();

        return {
            courseName:    div.querySelector('.courseName').value.trim(),
            courseCode:    div.querySelector('.courseCode').value.trim(),
            courseSection: div.querySelector('.courseSection').value.trim(),
            creditHours:   div.querySelector('.creditHours').value.trim(),
            crn:           div.querySelector('.crn').value.trim(),
            startDate:     formatDateMDY(div.querySelector('.startDate').value),
            endDate:       formatDateMDY(div.querySelector('.endDate').value),
            days:          Array.from(div.querySelectorAll('.dayChk:checked')).map(c=>c.value),
            startTime:     to12Hour(div.querySelector('.startTime').value),
            endTime:       to12Hour(div.querySelector('.endTime').value),
            location:      `${campus}, ${building}, ${room}`,
            instructor:    div.querySelector('.instructor').value.trim()
        };
    });
}

/**
 * Check if required fields are filled. If not will highlight those input boxes. 
 * 
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if no missing fields, else `false`.
 */
function validateRequiredField(div, index) {
    const requiredEls = div.querySelectorAll('input[required]');
    let missing = false;

    // Highlight missing required fields and set up on-blur validation
    requiredEls.forEach(input => {
        const isEmpty = !input.value.trim();
        highlightIf(isEmpty, input);
        if (isEmpty) missing = true;
        // Add blur handler for real-time feedback
        input.addEventListener('blur', () => {
            highlightIf(!input.value.trim(), input);
        });
    });

    // If any required field is missing, show alert and exit
    if (missing) {
        showAlert(`Please fill out all required fields in entry #${index+1}.`, false, () => {
            console.warn("Acknowledged missing fields");
        });
        return false;
    }
    return true;
}

/**
 * Check for valid date range.
 * 
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if valid date range, else `false`.
 */
function validateDateRange(div, index) {
    const startDateEl = div.querySelector('.startDate');
    const endDateEl = div.querySelector('.endDate');
    return validateRange(startDateEl, endDateEl, index);
}

/**
 * Check if at least one day is selected. 
 * 
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if at least one is selected, else `false`. 
 */
function validateDaysSelected(div, index) {
    const daysContainer = div.querySelector('.days-checkboxes');
    const checkedDays = div.querySelectorAll('.dayChk:checked');
    daysContainer.classList.remove('not-checked');
    if (checkedDays.length === 0) {
        daysContainer.classList.add('not-checked');
        showAlert(`Please select at least <strong><u>one day</u></strong> in entry #${index+1}.`, 
            false, 
            () => {console.warn("Acknowledged missing days");}
        );
        return false;
    }
    return true;
}

/**
 * Check for valid time range. 
 * 
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if valid time range, else `false`.
 */
function validateTimeRange(div, index) {
    const startTimeEl = div.querySelector('.startTime');
    const endTimeEl = div.querySelector('.endTime');
    return validateRange(startTimeEl, endTimeEl, index);
}

/**
 * Check if the course code are in correct format.
 * 
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if course code are formatted correctly, else `false`. 
 */
function validateCourseCode(div, index) {
    const courseCodeInput = div.querySelector('.courseCode');
    const rawCode = courseCodeInput.value.trim().toUpperCase();

    const correctFormat = /^[A-Z]+ [0-9]+$/.test(rawCode);
    // Highlight invalid course code
    highlightIf(!correctFormat, courseCodeInput);

    // Add blur handler for real-time feedback
    courseCodeInput.addEventListener('blur', () => {
        const val = courseCodeInput.value.trim().toUpperCase();
        highlightIf(!/^[A-Z]+ [0-9]+$/.test(val), courseCodeInput);
    });

    if (!correctFormat) {
        showAlert(`Incorrect 'Course Code' format in entry #${index+1}<br><br>Ex: MATH 204`, false, () => {
            console.warn("Acknowledged incorrect Course codes");
        });
    }
    return correctFormat;
}

/**
 * Validates a single course entry block by running all required validation checks in order.
 *
 * This function sequentially checks for:
 *   1. All required fields are filled
 *   2. The date range is valid (start <= end)
 *   3. At least one weekday is selected
 *   4. The time range is valid (start <= end)
 *   5. The course code format is correct (e.g., MATH 204)
 *
 * If any check fails, the function returns false immediately and may show an alert or highlight fields.
 *
 * @param {HTMLElement} div - The entry block element representing a single course form.
 * @param {number} index - The index of the entry (for error reporting in alerts).
 * @returns {boolean} `True` if all validations pass, `false` otherwise.
 */
function validateEntry(div, index) {
    // Check for missing required fields
    if (!validateRequiredField(div, index)) return false;
    // Check that the date range is valid
    if (!validateDateRange(div, index)) return false;
    // Check that at least one weekday is selected
    if (!validateDaysSelected(div, index)) return false;
    // Check that the time range is valid
    if (!validateTimeRange(div, index)) return false;
    // Check that the course code format is correct
    if (!validateCourseCode(div, index)) return false;
    // All checks passed
    return true;
}

/**
 * Validates all course entry blocks and builds the payload for saving courses.
 *
 * This function checks that at least one entry exists, then validates each entry using `validateEntry`.
 * If any entry fails validation, it shows an alert and returns null. If all entries are valid,
 * it returns the payload array for backend processing.
 *
 * @async async function.
 * @param {HTMLElement[]} entryDivs - Array of entry block elements (each representing a course form).
 * @returns {Promise<Array<Object>|null>} The payload array if all entries are valid, or null if validation fails.
 */
async function handleSaveCourses(entryDivs) {
    // Check that there is at least one entry to save
    if (!entryDivs || !entryDivs.length) {
        showAlert('Please add at least one course entry before saving.', false, () => {
            console.log("Acknowledged alert for not having at least one entry");
        });
        return null;
    }

    // Validate each entry block in order
    for (let i = 0; i < entryDivs.length; i++) {
        const div = entryDivs[i];
        if (!validateEntry(div, i)) return null; // Stop and return null if any entry is invalid
    }

    // All entries are valid; build and return the payload
    return buildEntriesPayload(entryDivs);
}

//-------------------------------------------------------
//                  Using above functions               |
//-------------------------------------------------------

// Generate and persist a unique tab/session ID for this browser tab
let tabId = sessionStorage.getItem('tabId');
if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
}

// Patch window.fetch to always include the tab ID in headers for backend session tracking
const originalFetch = window.fetch;
window.fetch = function(input, init = {}) {
    init.headers = {
        ...(init.headers || {}), 
        'X-Tab-ID': tabId
    };
    return originalFetch(input, init);
}

// Theme toggle and scroll-based UI behavior
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    // Updates the theme toggle button's icon and label based on the current theme
    const updateButtonUI = (isDark) => {
        icon.textContent = isDark ? '☀️' : '🌙'; // Sun for dark mode, moon for light mode
        label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    // Detect if the user prefers dark mode via OS/browser settings
    const matchDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Helper to determine if the current time is considered "night" (7pm-7am)
    const isTimeDark = () => {
        const hour = new Date().getHours();
        return hour >= 19 || hour < 7;
    };

    // Set initial theme: dark if user prefers or it's nighttime
    const isDark = matchDark || isTimeDark();
    body.classList.toggle('dark', isDark);
    updateButtonUI(isDark);

    // Toggle theme on button click and update UI accordingly
    toggleBtn.addEventListener('click', () => {
        const nowDark = body.classList.toggle('dark');
        updateButtonUI(nowDark);
    });

    // Store the initial bottom position of the toggle container for scroll detection
    const initialBottom = toggleContainer.getBoundingClientRect().bottom + window.pageYOffset;

    // Add or remove a class to the toggle container when the user scrolls past its initial position
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > initialBottom) {
            toggleContainer.classList.add('scrolled'); // Add sticky/fixed style
        } else {
            toggleContainer.classList.remove('scrolled');
        }
    });
});

// Change the file name based on file upload
fileInput.addEventListener('change', () => {
    // If no file is selected, display a default message
    if (fileInput.files.length === 0) {
        fileNameSpan.textContent = 'No file chosen';
    } else {
        // Get the name of the selected file
        let name = fileInput.files[0].name;
        // If the file name is longer than 30 characters, truncate and add ellipsis
        if (name.length > 30) {
            name = name.slice(0, 30) + '...';
        }
        // Display the (possibly truncated) file name in the UI
        fileNameSpan.textContent = name;
    }
});

// Remove all temporary data for this session when the clear button is clicked
clearTempBtn.addEventListener('click', async () => {
    // Ask the user for confirmation before deleting data
    const confirmed = await showConfirm('DELETE all temporary data?');
    if (!confirmed) return; // Exit if user cancels

    try {
        // Send a POST request to the backend to clean up session data
        const res = await fetch(`${BACKEND}/cleanup/${tabId}`, {method : 'POST'});
        const json = await res.json();

        if (res.ok) {
            // Remove the tab/session ID from sessionStorage
            sessionStorage.removeItem('tabId');
            // Notify the user that data was cleared
            showAlert("Temporary data cleared.", false, () => {
                console.log("[cleanup] Deleted temporary data.");
            });
            // Hide the schedule PDF icon and reset related UI
            hideScheduleIcon();

            // Clear all schedule data and UI elements
            scheduleData = {};
            clearEl(classList);
            clearEl(floorplanContainer);
            dayButtons.forEach(btn => btn.disabled = true);
        } else {
            // Show an error alert if the backend returns an error
            showAlert('Error: ' + (json.error || res.statusText), false, () => {
                console.log("Acknowledged error");
            });
        }
    } catch (err) {
        // Show an alert if there was a network or fetch error
        showAlert('Network error while clearing data.', false, () => {
            console.error(err);
        });
    }
});

/**
 * Clean up temporary session data on tab close or navigation away
 * The 'pagehide' event fires when the user closes the tab, reloads, or navigates away.
 * This ensures the backend can remove any session-specific data for this tab.
 */
window.addEventListener('pagehide', () => {
    if (!tabId) return; // No session to clean up
    const url = `${BACKEND}/cleanup/${tabId}`;
    // Use sendBeacon for a reliable, non-blocking request during page unload
    navigator.sendBeacon(url);
});

console.log("🟢 script.js loaded.");

// Counter to help with drag & drop feature. 
let dragCounter = 0;

document.addEventListener('dragenter', e => {
    halt(e); // Prevent default browser drag behavior
    if (dragCounter === 0) { // If this is the first dragenter event
        overlay.classList.add('visible'); // Show the overlay
    }
    dragCounter++; // Increment counter for nested drags
});

document.addEventListener('dragover', e => {
    halt(e); // Prevent default browser drag behavior
});

document.addEventListener('dragleave', e => {
    halt(e); // Prevent default browser drag behavior
    dragCounter--; // Decrement the drag counter for nested drags
    if (dragCounter === 0) { // If all drags have left
        overlay.classList.remove('visible'); // Hide the overlay
    }
});

document.addEventListener('drop', e => {
    halt(e); // Prevent default browser drag behavior
    dragCounter = 0; // Reset the drag counter since drop ends the drag sequence
    overlay.classList.remove('visible'); // Hide the overlay after drop
});

document.addEventListener('drop', e => {
    const dt = e.dataTransfer; // Get the data transfer object from the event
    if (!dt || dt.files.length === 0) return; // Exit if no files were dropped

    const file = dt.files[0]; // Take the first dropped file
    if (file.type !== 'application/pdf') { // Only accept PDF files
        showAlert('Please drop a PDF file.', false, () => {
            console.warn('Acknowledge to drop PDF.');
        });
        return;
    }

    // Create a new DataTransfer to programmatically set the file input
    const dataTrans = new DataTransfer();
    dataTrans.items.add(file); // Add the dropped file
    fileInput.files = dataTrans.files; // Set the file input's files

    fileNameSpan.textContent = file.name; // Update the UI with the file name
    fileInput.dispatchEvent(new Event('change', {bubbles: true})); // Trigger change event for file input
    loadSchedule(); // Start loading and parsing the schedule
});

// View the schedule PDF
viewPdfIcon.addEventListener('click', () => {
    pdfFrame.src = `${BACKEND}/${tabId}/schedule.pdf`; // Set the PDF iframe source to the current schedule
    toggleContainer.style.display = 'none'; // Hide the theme toggle while modal is open
    pdfModal.classList.add('open'); // Show the PDF modal
});

// Close PDF modal
pdfModalClose.addEventListener('click', () => {
    pdfModal.classList.remove('open'); // Hide the PDF modal
    toggleContainer.style.display = 'flex'; // Show the theme toggle again
    pdfFrame.src = ''; // Clear the PDF iframe source
});

openInstructionLink.addEventListener('click', e => {
    halt(e); // Prevent default link behavior and event bubbling
    showAlert(createPdfInstructions(), false, () => { // Show the PDF instructions in a modal
        console.log("Instruction for personal schedule PDF was displayed."); // Log when user closes the alert
    });
    closeScheduleModal.click(); // Close the schedule modal if open
});

// control manual input screen
manualBtn.addEventListener('click', () => modal.style.display = 'flex');
closeBtn.addEventListener('click', () => modal.style.display = 'none');

// Add entry block when clicked
addEntryBtn.addEventListener('click', () => entriesContainer.appendChild(createEntryBlock()));

/**
 * Handles the logic for the Save Courses button.
 *
 * - Validates all course entry blocks for required fields, date/time ranges, days, and course code format.
 * - Shows alerts for missing or invalid data and highlights fields as needed.
 * - If all entries are valid, builds a payload and sends it to the backend for parsing.
 *
 * @event click
 */
const saveCoursesBtn = document.getElementById('saveCourses');
saveCoursesBtn.addEventListener('click', async e => {
    console.log('🔵 [saveCourses] clicked');
    // Collect all the .entry blocks (each represents a course form)
    const entryDivs = Array.from(document.querySelectorAll('.entry'));

    // Build the payload for all valid entries
    const entries = await handleSaveCourses(entryDivs);
    if (!entries) return;

    console.log('📨 sending entries payload:', entries);

    // POST to /parse_text endpoint for backend processing
    parseEntries(entries);
});


/* Opens the example schedule modal when the example row is clicked. */
exampleScheduleRow.addEventListener('click', e => {
    halt(e); // Prevent default and stop propagation
    scheduleModal.style.display = 'flex'; // Show the example schedule modal
});

/* Removes the 'active' highlight class from all resource list items. */
function clearActiveHighlights() {
    resourceList.forEach(li => li.classList.remove('active'));
}

/* Removes the 'selected' highlight class from all resource items. */
function clearSelectedHighlights() {
    resourceItems.forEach(li => li.classList.remove('selected'));
}

// View resources
viewResourcesBtn.addEventListener('click', () => {
    clearActiveHighlights();
    clearSelectedHighlights();
    resourceModal.style.display = 'flex';
});

/* Handles click events for each resource item in the resources modal. */
resourceItems.forEach(li => {
    li.addEventListener('click', () => {
        clearSelectedHighlights(); // Remove previous selection
        li.classList.add('selected'); // Highlight this item

        if (li.id === 'exampleScheduleRow') {
            scheduleModal.style.display = 'flex'; // Show example schedule modal
        } else {
            const link = li.querySelector('a');
            if (link) window.open(link.href, '_blank'); // Open resource link
        }
    });
});

/* Handles click events for resource list items with descriptions. */
resourceList.forEach(li => {
    li.addEventListener('click', e => {
        halt(e, true); // Stop propagation, do not prevent default
        clearActiveHighlights(); // Remove previous highlights
        li.classList.toggle('active'); // Toggle description visibility
    });
});

/* Close the resource modal logic */
document.getElementById('closeResourcesModal').addEventListener('click',  () => {
    resourceModal.style.display = 'none';
    clearActiveHighlights();
    clearSelectedHighlights();
});

/* Display the example schedule PDF */
document.getElementById('schedThumbnail').addEventListener('click', e => {
    halt(e);
    scheduleModal.style.display = 'flex';
});

/* Close when click outside of current modal */
closeModalOnOutsideClick(scheduleModal);
closeModalOnOutsideClick(resourceModal);
closeModalOnOutsideClick(modal);

/* Handles the click event for loading the example schedule. */
loadExampleScheduleBtn.addEventListener('click', async () => {
    try {
        // Load the example schedule entries from a static JSON file
        const entries = await loadJSON('static/example_schedule.json');
        // Hide the resource modal after loading
        resourceModal.style.display = 'none';
        // Indicate processing state on the resources button
        setButtonState(viewResourcesBtn, 'Processing ...', true);
        // Parse and save the loaded entries
        await parseEntries(entries);
        // Restore the resources button to its default state
        setButtonState(viewResourcesBtn, 'View Resources', false);
    } catch (error) {
        // Log any errors that occur during loading or parsing
        console.error('❌ load‑and‑parse error:', err);
    }
});

// Close schedule modal logic
closeScheduleModal.addEventListener('click',  () => {
    scheduleModal.style.display = 'none';
});


/* Handles the click event for the Load Schedule button. */
loadBtn.addEventListener('click', evt => {
    evt.preventDefault();
    console.log('🔵 [loadBtn] clicked');
    loadSchedule();
});

/* Sets up click handlers for each day button in the UI. */
dayButtons.forEach(btn => {
    btn.disabled = true; // Disable until schedule is loaded
    btn.addEventListener('click', () => {
        console.log(`⬤ clicked: ${btn.dataset.day}`);
        // Remove 'active' class from all day buttons
        dayButtons.forEach(b => b.classList.remove('active'));
        // Add 'active' class to the clicked button
        btn.classList.add('active');
        // Show the schedule for the selected day
        showDay(btn.dataset.day);
    });
});
