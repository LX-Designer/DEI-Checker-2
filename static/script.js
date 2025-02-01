// Reusable function to initialize tooltips
function initializeTooltips() {
    const tooltip = document.getElementById("tooltip");
    const resultContainer = document.getElementById("result");

    document.querySelectorAll(".highlight").forEach(element => {
        element.addEventListener("mouseenter", (event) => {
            const title = event.target.getAttribute("data-title");
            tooltip.textContent = title;
            tooltip.style.display = "block";

            const rect = event.target.getBoundingClientRect();
            const resultRect = resultContainer.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // Horizontal Clamping
            const maxLeft = resultRect.width - tooltipRect.width;
            let leftPosition = rect.left - resultRect.left + rect.width / 2 - (tooltipRect.width / 2);
            leftPosition = Math.max(0, Math.min(leftPosition, maxLeft));

            // Default position: tooltip ABOVE the word
            let topPosition = rect.top - resultRect.top - tooltip.offsetHeight - 10;

            // Reset arrow orientation
            tooltip.classList.remove("bottom");

            // If tooltip overflows above, move it BELOW the word
            if (topPosition < 0) {
                topPosition = rect.bottom - resultRect.top + 10;
                tooltip.classList.add("bottom"); // Flip arrow upwards
            }

            // Clamp vertically within container
            const maxTop = resultRect.height - tooltipRect.height;
            topPosition = Math.max(0, Math.min(topPosition, maxTop));

            // Apply positions
            tooltip.style.left = `${leftPosition}px`;
            tooltip.style.top = `${topPosition}px`;
        });

        element.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
            tooltip.classList.remove("bottom"); // Reset on mouse leave
        });
    });
}



// Function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Analyze button event listener
document.getElementById("analyzeButton").addEventListener("click", async () => {
    const inputText = document.getElementById("inputText").value.trim();

    if (!inputText) {
        alert("Please enter some text before analyzing.");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: inputText })
        });

        const result = await response.json();
        const highlightedTextContainer = document.getElementById("highlightedText");
        const issuesList = document.getElementById("issuesList");
        const resultContainer = document.getElementById("result");

        highlightedTextContainer.innerHTML = "";
        issuesList.innerHTML = "";

        if (result.error) {
            highlightedTextContainer.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
            return;
        }

        let highlightedText = result.input_text;

        result.analysis.forEach(issue => {
            const escapedTerm = escapeRegExp(issue.term);
            const regex = issue.term.includes(" ")
                ? new RegExp(`${escapedTerm}`, "gi")
                : new RegExp(`\\b${escapedTerm}\\b`, "gi");

            highlightedText = highlightedText.replace(regex, `<span class="highlight" data-title="${issue.feedback}">${issue.term}</span>`);

            const listItem = document.createElement("li");
            listItem.innerHTML = `<strong>${issue.term}:</strong> ${issue.feedback}`;
            issuesList.appendChild(listItem);
        });

        highlightedTextContainer.innerHTML = `<p>${highlightedText}</p>`;
        resultContainer.style.display = "block";

        initializeTooltips();

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while analyzing the text. Please try again.");
    }
});

// Upload button event listener
document.getElementById("uploadButton").addEventListener("click", async () => {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file to upload.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("http://127.0.0.1:5000/upload", {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        const highlightedTextContainer = document.getElementById("highlightedText");
        const issuesList = document.getElementById("issuesList");
        const resultContainer = document.getElementById("result");

        highlightedTextContainer.innerHTML = "";
        issuesList.innerHTML = "";

        if (result.error) {
            highlightedTextContainer.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
            return;
        }

        let highlightedText = result.input_text;

        result.analysis.forEach(issue => {
            const escapedTerm = escapeRegExp(issue.term);
            const regex = issue.term.includes(" ")
                ? new RegExp(`${escapedTerm}`, "gi")
                : new RegExp(`\\b${escapedTerm}\\b`, "gi");

            highlightedText = highlightedText.replace(regex, `<span class="highlight" data-title="${issue.feedback}">${issue.term}</span>`);

            const listItem = document.createElement("li");
            listItem.innerHTML = `<strong>${issue.term}:</strong> ${issue.feedback}`;
            issuesList.appendChild(listItem);
        });

        highlightedTextContainer.innerHTML = `<p>${highlightedText}</p>`;
        resultContainer.style.display = "block";

        initializeTooltips();

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while uploading the file. Please try again.");
    }
});

// Initialize tooltips on DOMContentLoaded
document.addEventListener("DOMContentLoaded", initializeTooltips);
