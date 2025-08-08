// hold schedule json returned from server
let scheduleData = {};
// server location
const BACKEND = 'http://127.0.0.1:5000';

// get the elements
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
const closeBtn = document.getElementById('closeModal')
const addEntryBtn = document.getElementById('addEntryBtn');
const entriesContainer = document.getElementById('entriesContainer');
const saveCourseBtn = document.getElementById('saveCourses');

// get the tab id for each session
let tabId = sessionStorage.getItem('tabId');
if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
}

// make sure each fetch have tab id with it
const originalFetch = window.fetch;
window.fetch = function(input, init = {}) {
    init.headers = {
        ...(init.headers || {}), 
        'X-Tab-ID': tabId
    };
    return originalFetch(input, init);
}

// change the label after click and change the website theme
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    // change correspondingly
    const updateButtonUI = (isDark) => {
        icon.textContent = isDark ? '☀️' : '🌙';
        label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    const matchDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isTimeDark = () => {
        const hour = new Date().getHours();
        return hour >= 19 || hour < 7;
    };

    const isDark = matchDark || isTimeDark();
    body.classList.toggle('dark', isDark);
    updateButtonUI(isDark);

    toggleBtn.addEventListener('click', () => {
        const nowDark = body.classList.toggle('dark');
        updateButtonUI(nowDark);
    });

    const initialBottom = toggleContainer.getBoundingClientRect().bottom + window.pageYOffset;

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > initialBottom) {
            toggleContainer.classList.add('scrolled');
        } else {
            toggleContainer.classList.remove('scrolled');
        }
    });
});


// change the file name based on file upload
fileInput.addEventListener('change', () => {
    if (fileInput.files.length === 0) {
        fileNameSpan.textContent = 'No file chosen';
    } else {
        let name = fileInput.files[0].name;
        if (name.length > 30) {
            name = name.slice(0, 30) + '...';
        }
        fileNameSpan.textContent = name;
    }
});

/**
 * Highlight the input box depending on the 'condition' to change the 'input'
 * * Will set the flagRef to true when condition is `true`
 * 
 * @param {boolean} condition 
 * @param {Element} input 
 * @param {{value: boolean}} flagRef 
 */
function highlightIf(condition, input, flagRef = null) {
    if (condition) {
        input.style.border = '1px solid red';
        input.style.borderRadius = '4px';

        if (flagRef && typeof flagRef === 'object' && 'value' in flagRef) {
            flagRef.value = true;
        }
    } else {
        input.style.border = '';
        input.style.borderWidth = '1px';
        input.style.borderRadius = '4px';
    }
}

/**
 * Format an ISO date into U.S. style date
 * @param {string} isoDate 
 *  ISO-formatted date string
 * @returns {string}
 *  formatted date in "MM/DD/YYYY" or ""
 */
function formatDateMDY(isoDate) {
    // Guard against empty values
    if (!isoDate) return "";
    // isoDate is "YYYY-MM-DD"
    const [year, month, day] = isoDate.split("-");
    return `${month}/${day}/${year}`;
}

// change the hour to correct format
function to12Hour(hhmm) {
    if (!hhmm || !hhmm.includes(':')) {
        showAlert("Missing or invalid time fields", false, () => {
            console.warn("Error in time fields.");
        });
    }
    let [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const hh = h.toString().padStart(2, '0');
    return `${hh}:${m.toString().padStart(2,'0')} ${suffix}`;
}

/**
 * Validates that end ≥ start for a pair of data range.
 * @param {HTMLElement} startEl 
 * @param {HTMLElement} endEl 
 * @param {number} entryIdx 
 * @returns {boolean} true if valid, false if invalid.
 */
function validateRange(startEl, endEl, entryIdx) {
    const type = startEl.type;
    let valid;

    if (type === 'date') {
        const start = new Date(startEl.value);
        const end = new Date(endEl.value);
        valid = end >= start;
    } else if (type === 'time'){
        valid = endEl.value >= startEl.value;
    } else {
        showAlert(
            'Incorrect html element passed!',
            false, 
            () => console.warn(`Acknowledged bad element passed`)
        );
        return false;
    }

    if (!valid) {
        highlightIf(true, startEl);
        highlightIf(true, endEl);

        const errorType = type.charAt(0).toUpperCase() + type.slice(1) + ' error:';
        showAlert(
            `<strong>${errorType}</strong><br>
            <u>End ${type}</u> must be on or after the <u>start ${type}</u> in entry #${entryIdx + 1}.`,
            false, 
            () => console.warn(`Acknowledged bad ${type} range`)
        );
        return false;
    }
    highlightIf(false, startEl);
    highlightIf(false, endEl);
    return true;
}

/**'
 * Update a button's disabled state and label
 * @param {HTMLButtonElement} button
 *  button to be changed
 * @param {string} label 
 *  text to be changed to
 * @param {boolean} disabled 
 *  flag to indicate if disable the button or not
 */
function setButtonState(button, label, disabled = true) {
    button.disabled = disabled;
    button.textContent = label;
}

// alert modal
function showAlert(message, withCancel, callback) {
    const modal = document.getElementById('customAlert');
    const msgEl = document.getElementById('alertMessage');
    const cancelBtn = document.getElementById('alertCancel');
    const okBtn = document.getElementById('alertOk');

    msgEl.innerHTML = message;
    cancelBtn.style.display = withCancel ? 'inline-block' : 'none';
    modal.style.display = 'flex';

    const cleanup = () => {
        modal.style.display = 'none';
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
    }

    const onCancel = () => {
        cleanup();
        callback(false);
    }

    const onOk = () => {
        cleanup();
        callback(true);
    }

    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
}

// modification of alert modal
function showConfirm(message) {
    return new Promise(resolve => {
        showAlert(message, true, confirmed => {
            console.log(
                confirmed 
                ? "Clicked OK for \'Clear Data\'"
                : "Clicked Cancel for \'Clear Data\'"
            );
            resolve(confirmed);
        });
    });
}

/**
 * Stops event propagation and optionally prevents the default browser behavior.
 * 
 * @param {Event} e 
 *  The event object.
 * @param {boolean} skipPreventDefault 
 *  [skipPreventDefault=false] if true, skip calling preventDefault().
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
 * @param {HTMLElement} modalElement 
 *  The modal element to apply the outside-click close behavior to.
 * @returns 
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


// remove temporary data
clearTempBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('DELETE all temporary data?');
    if (!confirmed) return;

    try {
        const res = await fetch(`${BACKEND}/cleanup/${tabId}`, {method : 'POST'});
        const json = await res.json();

        if (res.ok) {
            sessionStorage.removeItem('tabId');
            showAlert("Temporary data cleared.", false, () => {
                console.log("[cleanup] Deleted temporary data.");
            });
            // hide the pdf icon for the schedule pdf
            hideScheduleIcon();

            scheduleData = {};
            clearEl(classList);
            clearEl(floorplanContainer);
            dayButtons.forEach(btn => btn.disabled = true);
        } else {
            showAlert('Error: ' + (json.error || res.statusText), false, () => {
                console.log("Acknowledged error");
            });
        }
    } catch (err) {
        showAlert('Network error while clearing data.', false, () => {
            console.error(err);
        });
    }
});
// remove before closing the tab
window.addEventListener('pagehide', () => {
    if (!tabId) return;
    const url = `${BACKEND}/cleanup/${tabId}`;
    navigator.sendBeacon(url);
});

console.log("🟢 script.js loaded.");

// clean the container
function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

// load schedule pdf
async function loadSchedule() {
    console.log('[loadSchedule] clicked, files:', fileInput.files);
    if (!fileInput.files.length) {
        showAlert('Please select a schedule PDF first.', false, () => {
            console.warn('... no file selected');
        });
        return;
    }
    // change text to process it
    setButtonState(loadBtn, 'Parsing ...', true);

    const form = new FormData();
    form.append('file', fileInput.files[0]);

    const res = await fetch(`${BACKEND}/parse_schedule`, {
            method: 'POST',
            body: form
        });
    const text = await res.text();
    let payload;

    try {
        payload = JSON.parse(text);
        console.log("✅ Schedule loaded");
    } catch {
        showAlert('Server error - please check the console for details.', false, () => {
            console.error('Non-JSON response:', text);
        });
        setButtonState(loadBtn, 'Load Schedule', false);
        return;
    } 

    if (!res.ok) {
        showAlert('Error: ' + (payload.error || res.statusText), false, () => {
            console.log('Acknowledged error');
        });
        setButtonState(loadBtn, 'Load Schedule', false);
        return;
    }

    if (payload) {
        viewPdfIcon.hidden = false;
    }

    scheduleData = payload;

    dayButtons.forEach(btn => {
        btn.disabled = false;
    });
    // default 'Monday' button selected
    console.log("⤷ triggering default click on", dayButtons[0].dataset.day);
    dayButtons[0].click();
    setButtonState(loadBtn, 'Load Schedule', false);    
}

let dragCounter = 0;

document.addEventListener('dragenter', e => {
    halt(e);
    if (dragCounter === 0) {
        overlay.classList.add('visible');
    }
    dragCounter++;
});

document.addEventListener('dragover', e => {
    halt(e);
});

document.addEventListener('dragleave', e => {
    halt(e);
    dragCounter--;
    if (dragCounter === 0) {
        overlay.classList.remove('visible');
    }
});

document.addEventListener('drop', e => {
    halt(e);
    dragCounter = 0;
    overlay.classList.remove('visible');
});

document.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    if (!dt || dt.files.length === 0) return;

    const file = dt.files[0];
    if (file.type !== 'application/pdf') {
        showAlert('Please drop a PDF file.', false, () => {
            console.warn('Acknowledge to drop PDF.');
        });
        return;
    }

    const dataTrans = new DataTransfer();
    dataTrans.items.add(file);
    fileInput.files = dataTrans.files;

    fileNameSpan.textContent = file.name;
    fileInput.dispatchEvent(new Event('change', {bubbles: true}));
    loadSchedule();
});

viewPdfIcon.addEventListener('click', () => {
    pdfFrame.src = `${BACKEND}/${tabId}/schedule.pdf`;
    toggleContainer.style.display = 'none';
    pdfModal.classList.add('open');
});

// Close modal
pdfModalClose.addEventListener('click', () => {
    pdfModal.classList.remove('open');
    toggleContainer.style.display = 'flex';
    pdfFrame.src = '';
});

function createPdfInstructions() {
    return `
        <h2>Instruction to get PDF:</h2>
        <ol>
            <li>Click <a href="https://mywestern.wwu.edu/web4u" target="_blank" title="myWestern">
                                        here</a> and select \"Registration\".</li>
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

openInstructionLink.addEventListener('click', e => {
    halt(e);
    showAlert(createPdfInstructions(), false, () => {
        console.log("Acknowledged alert");
    });
    closeScheduleModal.click();
});

/**
 * Return a string of HTML to restrict only number.
 * @param {number} maxDigits 
 * @param {string} titleMsg 
 * @returns {string}
 */
function numericInput(maxDigits = 5, titleMsg) {
    const pattern = `\\d{1, ${maxDigits}}`;
    
    return [
        `inputmode="numeric"`,
        `pattern="${pattern}"`,
        `title="${titleMsg}"`,
        `onkeypress="if (!/[0-9]/.test(event.key)) event.preventDefault()"`,
        `oninput="this.value = this.value.replace(/\\D/g, '').slice(0, ${maxDigits})"`
    ].join(' ');
}

/**
 * Generates the full HTML string for a course entry form block.
 * 
 * @param {string} uniqueId 
 *  A unique identifier used to distinguish input groups, 
 * especially for radio button `name` attributes and element IDs.
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

// control manual input screen
manualBtn.addEventListener('click', () => modal.style.display = 'flex');
closeBtn.addEventListener('click', () => modal.style.display = 'none');

const DEFAULTS = {
    courseName: 'unknown',
    courseCode: 'UNK 000',
    courseSection: '0',
    creditHours: '4',
    crn: '00000',
    instructor: 'unknown'
};

/**
 * Create the entry block with necessary logics.
 * * updated createEntryBlock with properly placed remove button and form-row layout
 * @returns {HTMLDivElement}
 */
function createEntryBlock() {
    const uniqueId = 'entry_' + Math.random().toString(36).substring(2, 9);
    const wrapper = document.createElement('div');
    wrapper.classList.add('entry');
    wrapper.style = "border:1px solid #ccc;padding:.75rem;margin:.5rem 0;position:relative;display:flex;flex-direction:column;";
    wrapper.innerHTML = createCourseEntryHTML(uniqueId);
    const buildingInput = wrapper.querySelector(`#building-input-${uniqueId}`);
    const dropdown = wrapper.querySelector('.building-dropdown');
    const dataUrl = `${BACKEND}/data/building_map_with_coords.json`;
    let buildingList = [];

    fetch(dataUrl)
        .then(r => r.json())
        .then(map => {
            buildingList = Object.entries(map).map(([fullName, data]) => {
                const abbr = data.fileName.replace(/\.pdf$/i, '');
                return {fullName, abbr};
            });
        })
        .catch(err => {
            console.error('Could not lead building_map.json: ', err);
        })

    // building option dropdown
    function showDropdown() {
        const query = buildingInput.value.toLowerCase();
        dropdown.innerHTML = '';

        const filtered = buildingList.filter(b => 
            b.fullName.toLowerCase().includes(query) || b.abbr.toLowerCase().includes(query)
        );

        if (!filtered.length) {
            dropdown.classList.remove('show');
            return;
        }

        filtered.forEach(b => {
            const option = document.createElement('div');
            option.textContent = `${b.fullName} -- ${b.abbr}`;
            option.dataset.fullName = b.fullName;
            dropdown.appendChild(option);
        });

        dropdown.classList.add('show');
    }
    
    
    buildingInput.addEventListener('input', showDropdown);
    buildingInput.addEventListener('focus', showDropdown);

    dropdown.addEventListener('click', e => {
        if (e.target.dataset.fullName) {
            buildingInput.value = `${e.target.dataset.fullName} -- ${e.target.textContent.split('--')[1].trim()}`;
            dropdown.classList.remove('show');

            highlightIf(false, buildingInput);
        }
    });

    document.addEventListener('click', e => {
        const isInside = buildingInput.contains(e.target) || dropdown.contains(e.target);
        if (!isInside) {
            dropdown.classList.remove('show');
        }
    });

    const inputs = wrapper.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            highlightIf(!input.value.trim(), input);
        });
    });

    // remove button logic
    wrapper.querySelector('.removeEntryBtn').addEventListener('click', () => {
        entriesContainer.removeChild(wrapper);
    });

    // apply Defaults logic: reset selected fields
    const applyBtn = wrapper.querySelector('.applyDefaultsBtn');

    applyBtn.addEventListener('click', () => {
        // all selectors for the fields that want to have default values
        const fieldSelectors = [
            '.courseName',
            '.courseCode',
            '.courseSection',
            '.creditHours',
            '.crn',
            '.instructor'
        ];
        // grab NodeList of all default inputs
        const fields = Array.from(wrapper.querySelectorAll(fieldSelectors.join(',')));
        // map each field
        const rows = fields.map(f => f.closest('.form-row')).filter(r => r !== null);

        if (applyBtn.textContent === 'Set Floor Plan Defaults') {
            applyBtn._orig = {};
            fields.forEach(f => {
                applyBtn._orig[f.className] = f.value;
                if (DEFAULTS.hasOwnProperty(f.className)) {
                    f.value = DEFAULTS[f.className];
                }
                f.disabled = true;
                f.required = false;
                f.style.border = '';
            });
            // hide those rows
            rows.forEach(row => row.style.display = 'none');

            // change to 'Revert' button
            applyBtn.textContent = 'Revert';
            applyBtn.classList.add('revert');
        } else {
            const originals = applyBtn._orig || {};
            fields.forEach(f => {
                if (originals.hasOwnProperty(f.className)) {
                    f.value = originals[f.className];
                }
                f.disabled = false;
                f.required = true;
                f.onblur = () => highlightIf(!f.value.trim(), f);
            });
            rows.forEach(row => row.style.display = '');

            applyBtn.textContent = 'Set Floor Plan Defaults';
            applyBtn.classList.remove('revert');
            delete applyBtn._orig;
        }
    });

    wrapper.querySelectorAll('.dayChk').forEach(checkbox => {
        checkbox.addEventListener('change', e => {
            const container = e.target.closest('.days-checkboxes');
            if (container.querySelectorAll('.dayChk:checked').length > 0) {
                container.classList.remove('not-checked');
            }
        });
    });

    const campusBuildingInput = wrapper.querySelector('.building');
    const campusRoomInput = wrapper.querySelector('.room');
    const buildingRow = campusBuildingInput.closest('.form-row');
    const roomRow = campusRoomInput.closest('.form-row');

    let locationInfo = null;

    function updateCampusVisibility() {
        const checked = wrapper.querySelector(`input[name="${uniqueId}_campus"]:checked`);
        if (!checked) return;
        const selected = checked.value;

        if (selected === 'Online') {
            locationInfo = {
                building: campusBuildingInput.value,
                roomNum: campusRoomInput.value,
            };
            // default value for building and room number
            campusBuildingInput.value = 'Unknown Hall';
            campusRoomInput.value = '000';
            // don't display it
            buildingRow.style.display = 'none';
            roomRow.style.display = 'none';
            wrapper.querySelector('.building').required = false;
            wrapper.querySelector('.room').required = false;
        } else {
            if (locationInfo) {
                campusBuildingInput.value = locationInfo.building;
                campusRoomInput.value = locationInfo.roomNum;
            } else {
                campusBuildingInput.value = '';
                campusRoomInput.value = '';
            }
            
            buildingRow.style.display = '';
            roomRow.style.display = '';
            wrapper.querySelector('.building').required = true;
            wrapper.querySelector('.room').required = true;
        }
    }

    const campusRadios = wrapper.querySelectorAll(`input[name="${uniqueId}_campus"]`);
    campusRadios.forEach(radio => radio.addEventListener('change', updateCampusVisibility));

    updateCampusVisibility();

    return wrapper;
}


// add entry block when clicked
addEntryBtn.addEventListener('click', () => entriesContainer.appendChild(createEntryBlock()));

// save button logic
const saveCoursesBtn = document.getElementById('saveCourses');
saveCoursesBtn.addEventListener('click', async e => {
    console.log('🔵 [saveCourses] clicked');
    // Collect all the .entry blocks
    const entryDivs = Array.from(document.querySelectorAll('.entry'));
    if (!entryDivs.length) {
        showAlert('Please add at least one course entry before saving.', false, () => {
            console.log("Acknowledged alert");
        });
        return;
    }

    // check for empty fields for available entry block
    for (let i = 0; i < entryDivs.length; i++) {
        const div = entryDivs[i];
        const requiredEls = div.querySelectorAll('input[required]');
        let missing = {value: false};

        requiredEls.forEach(input => {
            highlightIf(!input.value.trim(), input, missing);

            input.onblur = () => {
                highlightIf(!input.value.trim(), input);
            };
        });

        if (missing.value) {
            showAlert(`Please fill out all required fields in entry #${i+1}.`, false, () => {
                console.warn("Acknowledged missing fields");
            });
            return;
        }

        // check for the date range
        const startDateEl = div.querySelector('.startDate');
        const endDateEl = div.querySelector('.endDate');
        if (!validateRange(startDateEl, endDateEl, i)) return;

        // check for the weekday checkboxes
        const daysContainer = div.querySelector('.days-checkboxes');
        const checkedDays = div.querySelectorAll('.dayChk:checked');
        daysContainer.classList.remove('not-checked');
        if (checkedDays.length === 0) {
            daysContainer.classList.add('not-checked');
            showAlert(`Please select at least <strong><u>one day</u></strong> in entry #${i+1}.`, false, () => {
                console.warn("Acknowledged missing days");
            });
            return;
        }

        // check for the time range
        const startTimeEl = div.querySelector('.startTime');
        const endTimeEl = div.querySelector('.endTime');
        if (!validateRange(startTimeEl, endTimeEl, i)) return;

        // check course code
        const courseCodeInput = div.querySelector('.courseCode');
        const rawCode = courseCodeInput.value.trim().toUpperCase();

        if (!/^[A-Z]+ [0-9]+$/.test(rawCode)) {
            courseCodeInput.style.border = '1px solid red';
            courseCodeInput.style.borderRadius = '4px';

            courseCodeInput.onblur = () => {
                const val = courseCodeInput.value.trim().toUpperCase();
                highlightIf(!/^[A-Z]+ [0-9]+$/.test(val), courseCodeInput);
            }

            showAlert(`Incorrect 'Course Code' format in entry #${i+1}<br><br>Ex: MATH 204`, false, () => {
                console.warn("Acknowledged incorrect Course codes");
            });
            return;
        } else {
            courseCodeInput.style.border = '';
        }

    }
    // Build payload
    const entries = entryDivs.map(div => {
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

    console.log('📨 sending entries payload:', entries);

    // POST to /parse_text
    parseEntries(entries);
});

async function parseEntries(entries) {
    try {
        const res = await fetch(`${BACKEND}/parse_text`, {
            method:  'POST',
            headers: { 'Content-Type':'application/json' },
            body:    JSON.stringify({ entries })
        });
        console.log('entries: ', entries);
        const json = await res.json();
        console.log('📥 parse_text response:', json);
        if (!res.ok) {
            throw new Error(json.error || res.statusText);
        }

        // Hand off to your normal UI
        hideScheduleIcon();
        scheduleData = json;
        dayButtons.forEach(b => b.disabled = false);
        dayButtons[0].click();

        // Close modal and clear entries
        entriesContainer.innerHTML = '';
        modal.style.display = 'none';

    } catch (err) {
        showAlert('Failed to save courses: ' + err.message, false, () => {
            console.error('❌ Error in parse_text:', err);
        });
    }
}

exampleScheduleRow.addEventListener('click', e => {
    halt(e);
    scheduleModal.style.display = 'flex';
});

function clearActiveHighlights() {
    resourceList.forEach(li => li.classList.remove('active')); 
}

function clearSelectedHighlights() {
    resourceItems.forEach(li => li.classList.remove('selected'));
}

// view resources
viewResourcesBtn.addEventListener('click', () => {
    clearActiveHighlights();
    clearSelectedHighlights();
    resourceModal.style.display = 'flex';
});

resourceItems.forEach(li => {
    li.addEventListener('click', () => {
        clearSelectedHighlights();
        li.classList.add('selected');

        if (li.id === 'exampleScheduleRow') {
            scheduleModal.style.display = 'flex';
        } else {
            const link = li.querySelector('a');
            if (link) window.open(link.href, '_blank');
        }
    });
});


resourceList.forEach(li => {
    li.addEventListener('click', e => {
        halt(e, true);
        clearActiveHighlights();
        li.classList.toggle('active');
    });
});

document.getElementById('closeResourcesModal').addEventListener('click',  () => {
    resourceModal.style.display = 'none';
    clearActiveHighlights();
    clearSelectedHighlights();
});

document.getElementById('schedThumbnail').addEventListener('click', e => {
    halt(e);
    scheduleModal.style.display = 'flex';
});

scheduleModal.addEventListener('click', (e) => {
    if (e.target === scheduleModal) {
        scheduleModal.style.display = 'none';
    }
});

resourceModal.addEventListener('click', (e) => {
    if (e.target === resourceModal) {
        resourceModal.style.display = 'none';
    }
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

async function loadJSON(json_link = 'static/example_schedule.json') {
    const resp = await fetch(json_link);
    if (!resp.ok) {
        throw new Error(`Failed to load JSON: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
}

loadExampleScheduleBtn.addEventListener('click', async () => {
    try {
        const entries = await loadJSON();
        resourceModal.style.display = 'none';
        setButtonState(viewResourcesBtn, 'Processing ...', true);
        await parseEntries(entries);
        setButtonState(viewResourcesBtn, 'View Resources', false);
    } catch (error) {
        console.error('❌ load‑and‑parse error:', err);
    }
});

closeScheduleModal.addEventListener('click',  () => {
    scheduleModal.style.display = 'none';
});

function showDay(day) {
    console.log(`▶ showDay() '${day}'`, 'scheduleData keys:', Object.keys(scheduleData));
    clearEl(classList);
    clearEl(floorplanContainer);

    const header = document.createElement('div');
    header.textContent = 'Click any class below to view its floor plan';
    header.classList.add('classListHeader');
    classList.appendChild(header);

    const entries = scheduleData[day] || [];
    console.log('   entries for', day, entries);

    if (!entries.length) {
        classList.textContent = 'No classes scheduled.';
        classList.classList.add('no-classes');
        return;
    }
    classList.classList.remove('no-classes');

    entries.forEach((entry, idx) => {
        const li = document.createElement('li');
        const hasUnknown = entry.course == 'UNK 000 - Unknown';
        const mainCampus = entry.campus === 'Main Campus';

        building = entry.building;
        if (building.includes('--')) {
            building = building.split('--')[0].trim();
        }

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

        li.dataset.idx = idx;
        li.classList.add('class-item');
        classList.appendChild(li);

        li.addEventListener('click', () => {
            console.log('⬤ li clicked:', entry);
            showFloorplan(mainCampus ? entry.map_pdf : '', entry.lat, entry.lon);
            classList.querySelectorAll('li').forEach(x => x.classList.remove('selected'));
            li.classList.add('selected');
        });
    });
}

function showFloorplan(pdfPath, lat, lon) {
    clearEl(floorplanContainer);

    if (!pdfPath) {
        floorplanContainer.classList.add('no-floorplan');
        floorplanContainer.textContent = 'No floor plan available.';
        return;
    }

    floorplanContainer.classList.remove('no-floorplan');

    const fn = pdfPath.split('/').pop();
    const pdfUrl = `${BACKEND}/${tabId}/floorplans/${fn}`;

    console.log('[showFloorplan] → url:', pdfUrl);
    const pdfFrame = document.createElement('iframe');
    pdfFrame.src = pdfUrl;
    pdfFrame.width = '100%';
    pdfFrame.height = '600px';
    pdfFrame.onload  = () => console.log('✅ PDF loaded');
    pdfFrame.onerror = e => console.error('❌ PDF error', e);
    floorplanContainer.appendChild(pdfFrame);

    if (lat == null || lon == null) {
        console.warn('No coordinates provided; skipping map iframe');
        return;
    }

    const mapFrame = document.createElement('iframe');
    mapFrame.src = `https://www.google.com/maps?output=embed&q=${lat},${lon}&z=19&t=k&output=embed`;
    mapFrame.width = '100%';
    mapFrame.height = '500px';
    mapFrame.style.marginTop = '1rem';
    mapFrame.onload  = () => console.log('✅ Map loaded');
    mapFrame.onerror = e => console.error('❌ Map error', e);
    floorplanContainer.appendChild(mapFrame);
}

loadBtn.addEventListener('click', evt => {
  evt.preventDefault();  
  console.log('🔵 [loadBtn] clicked');
  loadSchedule();
});

dayButtons.forEach(btn => {
    btn.disabled = true;
    btn.addEventListener('click', () => {
        console.log(`⬤ clicked: ${btn.dataset.day}`);
        dayButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showDay(btn.dataset.day);
    });
});

