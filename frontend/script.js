let scheduleData = {};
const BACKEND = 'http://127.0.0.1:5000';

const fileInput = document.getElementById('fileInput');
const fileNameSpan = document.getElementById('fileName');
const loadBtn = document.getElementById('loadBtn');
const manualBtn = document.getElementById('manualInputBtn');
const dayButtons = document.querySelectorAll('#daySelect button[data-day]');
const classList = document.getElementById('classList');
const floorplanContainer = document.getElementById('floorplanContainer');
const clearTempBtn = document.getElementById('clearTempBtn');

const modal = document.getElementById('manualModal');
const closeBtn = document.getElementById('closeModal')
const addEntryBtn = document.getElementById('addEntryBtn');
const entriesContainer = document.getElementById('entriesContainer');
const saveCourseBtn = document.getElementById('saveCourses');

let tabId = sessionStorage.getItem('tabId');
if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
}

const originalFetch = window.fetch;
window.fetch = function(input, init = {}) {
    init.headers = {
        ...(init.headers || {}), 
        'X-Tab-ID': tabId
    };
    return originalFetch(input, init);
}

fileInput.addEventListener('change', () => {
    if (fileInput.files.length === 0) {
        fileNameSpan.textContent = 'No file chosen';
    } else {
        let name = fileInput.files[0].name;
        if (name.length > 20) {
            name = name.slice(0, 20) + '...';
        }
        fileNameSpan.textContent = name;
    }
});

function formatDateMDY(isoDate) {
    // Guard against empty values
    if (!isoDate) return "";
    // isoDate is "YYYY-MM-DD"
    const [year, month, day] = isoDate.split("-");
    return `${month}/${day}/${year}`;
}

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

function showAlert(message, withCancel, callback) {
    const modal = document.getElementById('customAlert');
    const msgEl = document.getElementById('alertMessage');
    const cancelBtn = document.getElementById('alertCancel');
    const okBtn = document.getElementById('alertOk');

    msgEl.textContent = message;
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

function showConfirm(message) {
    return new Promise(resolve => {
        showAlert(message, true, confirmed => {
            if (confirmed) {
                console.log("Clicked OK for \'Clear Data\'");
            } else {
                console.log("Clicked Cancel for \'Clear Data\'");
            }
            resolve(confirmed);
        });
    });
}

// remove data
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

    loadBtn.disabled = true;
    loadBtn.textContent = 'Parsing ...';

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
        console.log("✅ scheduleData:", scheduleData);
    } catch {
        showAlert('Server error - please check the console for details.', false, () => {
            console.error('Non-JSON response:', text);
        });
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Schedule';
        return;
    } 

    if (!res.ok) {
        showAlert('Error: ' + (payload.error || res.statusText), false, () => {
            console.log('Acknowledged error');
        });
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Schedule';
        return;
    }

    scheduleData = payload;
    dayButtons.forEach(btn => {
        btn.disabled = false;
    });
    console.log("⤷ triggering default click on", dayButtons[0].dataset.day);
    dayButtons[0].click();
    loadBtn.disabled = false;
    loadBtn.textContent = 'Load Schedule';    
}

// manual input
manualBtn.addEventListener('click', () => modal.style.display = 'flex');
closeBtn.addEventListener('click', () => modal.style.display = 'none');

// updated createEntryBlock with properly placed remove button and form-row layout
function createEntryBlock() {
    const uniqueId = 'entry_' + Math.random().toString(36).substring(2, 9);
    const wrapper = document.createElement('div');
    wrapper.classList.add('entry');
    wrapper.style = "border:1px solid #ccc;padding:.75rem;margin:.5rem 0;position:relative;display:flex;flex-direction:column;";
    wrapper.innerHTML = `
        <button type="button" class="removeEntryBtn">✕</button>
        <div class="form-row">
            <label>Course Name<span class="required-star">*</span></label>
            <input type="text" class="courseName" placeholder="Elementary Linear Algebra" required>
        </div>
        <div class="form-row">
            <label>Course Code<span class="required-star">*</span></label>
            <input type="text" class="courseCode" placeholder="MATH 204" required>
        </div>
        <div class="form-row">
            <label>Section<span class="required-star">*</span></label>
            <input type="text" class="courseSection" placeholder="0" required>
        </div>
        <div class="form-row">
            <label>Credit Hours<span class="required-star">*</span></label>
            <input type="number" class="creditHours" placeholder="4" required>
        </div>
        <div class="form-row">
            <label>CRN<span class="required-star">*</span></label>
            <input type="text" class="crn" placeholder="40699" required>
        </div>
            <div class="form-row">
            <label>Date Range<span class="required-star">*</span></label>
            <input type="date" class="startDate" required><span>–</span><input type="date" class="endDate" required>
        </div>
        <div class="form-row">
            <label>Days<span class="required-star">*</span></label>
            <div class="days-checkboxes">
                <label><input type="checkbox" value="Monday" class="dayChk"> Monday\</label>
                <label><input type="checkbox" value="Tuesday" class="dayChk"> Tuesday</label>
                <label><input type="checkbox" value="Wednesday" class="dayChk"> Wednesday</label>
                <label><input type="checkbox" value="Thursday" class="dayChk"> Thursday</label>
                <label><input type="checkbox" value="Friday" class="dayChk"> Friday</label>
            </div>
        </div>
        <div class="form-row">
            <label>Time Range<span class="required-star">*</span></label>
            <input type="time" class="startTime" required><span>–</span><input type="time" class="endTime" required>
        </div>
        <div class="form-row">
            <label>Campus<span class="required-star">*</span></label>
            <div class="campus-options"">
                <label><input type="radio" name="${uniqueId}_campus" value="Main Campus" checked> Main Campus</label>
                <label><input type="radio" name="${uniqueId}_campus" value="Online"> Online</label>
            </div>
        </div>
        <div class="form-row">
            <label>Building<span class="required-star">*</span></label>
            <div class="building-container">
                <input type="text" id="building-input-${uniqueId}" class="building" placeholder="Bond Hall" required>
                <div class="building-dropdown"></div>
            </div>
        </div>
        <div class="form-row">
            <label>Room<span class="required-star">*</span></label>
            <input type="text" class="room" placeholder="225" required>
        </div>

        <div class="form-row">
            <label>Instructor<span class="required-star">*</span></label>
            <input type="text" class="instructor" placeholder="Ypma, Tjalling" required>
        </div>
        <button type="button" class="applyDefaultsBtn">Set Floor Plan Defaults</button>
    `;
    const buildingInput = wrapper.querySelector(`#building-input-${uniqueId}`);
    const dropdown = wrapper.querySelector('.building-dropdown');
    const dataUrl = `${BACKEND}/data/building_map.json`;
    let buildingList = [];

    fetch(dataUrl)
        .then(r => r.json())
        .then(map => {
            buildingList = Object.entries(map).map(([fullName, fileName]) => {
                const abbr = fileName.replace(/\.pdf$/i, '');
                return {fullName, abbr};
            });
        })
        .catch(err => {
            console.error('Could not lead building_map.json: ', err);
        })

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
            if (!input.value.trim()) {
                input.style.border = '1px solid red';
                input.style.borderRadius = '4px';
            } else {
                input.style.border = '';
            }
        });
    });

    // remove button logic
    wrapper.querySelector('.removeEntryBtn').addEventListener('click', () => {
        entriesContainer.removeChild(wrapper);
    });

    // apply Defaults logic: reset selected fields
    const applyBtn = wrapper.querySelector('.applyDefaultsBtn');
    // to store previous input
    let originals = null;

    applyBtn.addEventListener('click', () => {
        const nameInput = wrapper.querySelector('.courseName');
        const courseCodeInput = wrapper.querySelector('.courseCode');
        const courseSectionInput = wrapper.querySelector('.courseSection');
        const creditInput = wrapper.querySelector('.creditHours');
        const crnInput = wrapper.querySelector('.crn');
        const instructorInput = wrapper.querySelector('.instructor');

        // row to hide/show
        const rowsToChange = [
            nameInput.closest('.form-row'),
            courseCodeInput.closest('.form-row'),
            courseSectionInput.closest('.form-row'),
            creditInput.closest('.form-row'),
            crnInput.closest('.form-row'),
            instructorInput.closest('.form-row'),
        ];

        if (applyBtn.textContent === 'Set Floor Plan Defaults') {
            originals = {
                nameIn: nameInput.value,
                codeIn: courseCodeInput.value,
                sectionIn: courseSectionInput.value,
                creditIn: creditInput.value, 
                crnIn: crnInput.value, 
                insIn: instructorInput.value,
            };

            nameInput.value = "unknown";
            courseCodeInput.value = "UNK 000";
            courseSectionInput.value = "0";
            creditInput.value = "4";
            crnInput.value = "00000";
            instructorInput.value = "unknown";

            [nameInput, courseCodeInput, courseSectionInput, creditInput, crnInput, instructorInput].forEach(input => {
                input.disabled = true;
                input.required = false;
                input.style.border = '';
            });
            // hide those rows
            rowsToChange.forEach(row => row.style.display = 'none');

            // change to 'Revert' button
            applyBtn.textContent = 'Revert';
            applyBtn.classList.add('revert');
        } else {
            // change back to original values
            nameInput.value = originals.nameIn;
            courseCodeInput.value = originals.codeIn;
            courseSectionInput.value = originals.sectionIn;
            creditInput.value = originals.creditIn;
            crnInput.value = originals.crnIn;
            instructorInput.value = originals.insIn;

            [nameInput, courseCodeInput, courseSectionInput, creditInput, crnInput, instructorInput].forEach(input => {
                input.disabled = false;
                input.required = true;

                input.onblur = () => {
                    if (!input.value.trim()) {
                        input.style.border = '1px solid red';
                        input.style.borderRadius = '4px';
                    } else {
                        input.style.border = '';
                    }
                };
            });

            rowsToChange.forEach(row => row.style.display = '');

            applyBtn.textContent = 'Set Floor Plan Defaults';
            applyBtn.classList.remove('revert');
        }
    });

    return wrapper;
}


addEntryBtn.addEventListener('click', () => entriesContainer.appendChild(createEntryBlock()));

const saveCoursesBtn = document.getElementById('saveCourses');
saveCoursesBtn.addEventListener('click', async () => {
    console.log('🔵 [saveCourses] clicked');
    // Collect all the .entry blocks
    const entryDivs = Array.from(document.querySelectorAll('.entry'));
    if (!entryDivs.length) {
        showAlert('Please add at least one course entry before saving.', false, () => {
            console.log("Acknowledged alert");
        });
        return;
    }

    // Build payload
    const entries = entryDivs.map(div => {
        const campus = div.querySelector('.campus-options input:checked').value;
        const room = div.querySelector('.room').value.trim();

        const buildingInput = div.querySelector('.building');
        const rawLabel = buildingInput.value.trim();

        const listId = buildingInput.getAttribute('list');
        const datalist = div.querySelector(`#${listId}`);
        const optionEl = datalist ? datalist.querySelector(`option[value="${rawLabel.replace(/"/g, '\\"')}"]`) : null;
        const building = optionEl?.dataset.fullName || rawLabel;
        
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
    try {
        const res = await fetch(`${BACKEND}/parse_text`, {
            method:  'POST',
            headers: { 'Content-Type':'application/json' },
            body:    JSON.stringify({ entries })
        });
        const json = await res.json();
        console.log('📥 parse_text response:', json);
        if (!res.ok) {
            throw new Error(json.error || res.statusText);
        }

        // Hand off to your normal UI
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
        return;
    }

    entries.forEach((entry, idx) => {
        const li = document.createElement('li');
        const hasUnknown = entry.course == 'UNK 000 - unknown';

        building = entry.building;
        if (building.includes('--')) {
            building = building.split('--')[0].trim();
        }

        if (hasUnknown) {
            li.textContent = `🕒 ${entry.time} | 📍 ${building} ${entry.room}`;
        } else {
            li.textContent = `🕒 ${entry.time} | 📚 ${entry.course} | 📍 ${building} ${entry.room}`;
        }
        li.dataset.idx = idx;
        li.classList.add('class-item');
        classList.appendChild(li);

        li.addEventListener('click', () => {
            console.log('⬤ li clicked:', entry);
            showFloorplan(entry.map_pdf);
            classList.querySelectorAll('li').forEach(x => x.classList.remove('selected'));
            li.classList.add('selected');
        });
    });
}

function showFloorplan(pdfPath) {
    clearEl(floorplanContainer);

    if (!pdfPath) {
        floorplanContainer.classList.add('no-floorplan');
        floorplanContainer.textContent = 'No floor plan available.';
        return;
    }

    floorplanContainer.classList.remove('no-floorplan');

    const fn = pdfPath.split('/').pop();
    const url = `${BACKEND}/${tabId}/floorplans/${fn}`;

    console.log('[showFloorplan] → url:', url);
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.width = '100%';
    frame.height = '600px';
    frame.onload  = () => console.log('✅ iframe loaded');
    frame.onerror = e => console.error('❌ iframe error', e);

    floorplanContainer.appendChild(frame);
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