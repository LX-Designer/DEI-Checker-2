document.getElementById("analyzeButton").addEventListener("click", async () => {
    const inputText = document.getElementById("inputText").value;

    if (!inputText.trim()) {
        alert("Please enter some text before analyzing.");
        return;
    }

    try {
        // Send the input text to the backend
        const response = await fetch("http://127.0.0.1:5000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: inputText })
        });

        const result = await response.json();

        const outputText = document.getElementById("outputText");
        outputText.innerHTML = ""; // Clear previous results

        if (result.error) {
            outputText.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
            return;
        }

        // Display results with clear formatting
        let highlightedText = result.input_text;

        // Add tooltips for flagged terms
        result.analysis.forEach(issue => {
            const regex = new RegExp(`\\b${issue.term}\\b`, "g");
            highlightedText = highlightedText.replace(regex, `
                <span class="highlight" title="${issue.feedback}">
                    ${issue.term}
                </span>
            `);
        });

        // Add analyzed content and list of issues
        outputText.innerHTML = `
            <h3>Analyzed Content:</h3>
            <p>${highlightedText}</p>
            <h3>Issues Found:</h3>
            <ul>
                ${result.analysis.map(issue => `<li><strong>${issue.term}:</strong> ${issue.feedback}</li>`).join('')}
            </ul>
        `;

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while analyzing the text. Please try again.");
    }
});


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

        const outputText = document.getElementById("outputText");
        outputText.innerHTML = ""; // Clear previous results

        if (result.error) {
            outputText.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
            return;
        }

        // Display results with clear formatting
        let highlightedText = result.input_text;

        result.analysis.forEach(issue => {
            const regex = new RegExp(`\\b${issue.term}\\b`, "g");
            highlightedText = highlightedText.replace(regex, `
                <span class="highlight" title="${issue.feedback}">
                    ${issue.term}
                </span>
            `);
        });

        // Add instructions and clear feedback
        outputText.innerHTML = `
            <h3>Analyzed Content:</h3>
            <p>${highlightedText}</p>
            <h3>Issues Found:</h3>
            <ul>
                ${result.analysis.map(issue => `<li><strong>${issue.term}:</strong> ${issue.feedback}</li>`).join('')}
            </ul>
        `;

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while uploading the file. Please try again.");
    }
});
