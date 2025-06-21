document.getElementById("loadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("fileInput");
    const textInput = document.getElementById("textInput");
    let data = null;

    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append("schedule_pdf", fileInput.files[0]);
        const res = await fetch("/api/upload", {
            method : "POST", 
            body: formData
        });
        data = await res.json();

    } else if (textInput.ariaValueMax.trim()) {
        const res = await fetch("/api/upload_text", {
            method : "POST", 
            headers: {'Content-Type' : 'application/json'},
            body : JSON.stringify({text : textInput.value})
        });
        data = await res.json();

    } else {
        alert("Please provide a schedule.");
        return;
    }

    window.scheduleData = data.schedule;
    window.buildingMap = data.building_map;

    showDay("Monday");
});

document.querySelectorAll("#daySelect button").forEach(btn => {
    btn.addEventListener("click", () => {
        showDay(btn.dataset.day);
    });
});

function showDay(day) {
    const classes = (window.scheduleData[day] || []).sort((a, b) => a.time.localeCompare(b.time));
    const classList = document.getElementById("classList");
    classList.innerHTML = "";

    const floorDiv = document.getElementById("floorplanContainer");
    floorDiv.innerHTML = "";

    classes.forEach((cls, idx) => {
        const li = document.createElement("li");
        li.textContent = `${cls.time}: ${cls.course} (${cls.building}) ${cls.room} ${cls.instructor})`;
        classList.appendChild(li);

        const pdfName = window.buildingMap?.[cls.building];
        if (pdfName) {
            const bcode = pdfName.replace(".pdf", "");
            const img = document.createElement("img");
            img.src = '/floorplans_images/${bcode}_page1.png';
        }
    })
}