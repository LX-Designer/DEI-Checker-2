// Function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

document.addEventListener("DOMContentLoaded", () => {
    let currentTermIndex = 0;
    let termElements = [];

    const resultContainer = document.getElementById("result");
    const navButtons = document.querySelector(".nav-buttons");

    function updateNavButtonsPosition() {
        const containerRect = resultContainer.getBoundingClientRect();
        const navButtonsWidth = navButtons.offsetWidth;
        const centerX = containerRect.left + (containerRect.width / 2) - (navButtonsWidth / 2);
        navButtons.style.left = `${centerX}px`;
    }

    function updateCurrentTermIndex() {
        const viewportHeight = window.innerHeight;
        const middleOfViewport = viewportHeight / 2;

        termElements.forEach((term, index) => {
            const termRect = term.getBoundingClientRect();
            const termMiddle = termRect.top + (termRect.height / 2);

            if (termMiddle >= 0 && termMiddle <= middleOfViewport + 1) {
                if (currentTermIndex !== index + 1) {
                    currentTermIndex = index + 1;
                    console.log(`term index (scroll): ${currentTermIndex}`);
                }
            }
        });
    }

    window.addEventListener("resize", updateNavButtonsPosition);
    window.addEventListener("scroll", () => {
        updateNavButtonsPosition();
        updateCurrentTermIndex();
    });

    // Ensure the initial position is updated after the DOM is fully loaded
    setTimeout(updateNavButtonsPosition, 0);

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

            highlightedTextContainer.innerHTML = "";
            issuesList.innerHTML = "";

            if (result.error) {
                highlightedTextContainer.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
                return;
            }

            let highlightedText = result.input_text;
            let termCount = 0;
            const termPositions = [];

            result.analysis.forEach(issue => {
                const escapedTerm = escapeRegExp(issue.term);
                const regex = issue.term.includes(" ")
                    ? new RegExp(`${escapedTerm}`, "gi")
                    : new RegExp(`\\b${escapedTerm}\\b`, "gi");

                highlightedText = highlightedText.replace(regex, (match, offset) => {
                    termCount++;
                    const termId = `term-${termCount}`;
                    termPositions.push({ term: issue.term, feedback: issue.feedback, id: termId, position: offset });
                    return `<span id="${termId}" title="${issue.feedback}">${match}</span>`;
                });
            });

            // Sort terms by their positions in the input text
            termPositions.sort((a, b) => a.position - b.position);

            // Add sorted terms to the issues list
            termPositions.forEach(term => {
                const listItem = document.createElement("li");
                listItem.innerHTML = `<a href="#${term.id}" class="term-link"><strong>${term.term}</strong></a>: ${term.feedback}`;
                issuesList.appendChild(listItem);
            });

            highlightedTextContainer.innerHTML = `<p>${highlightedText}</p>`;
            resultContainer.style.display = "block";

            // Get all term elements
            termElements = document.querySelectorAll(".highlight");
            currentTermIndex = 0;

            // Add event listeners to the term links to scroll the term into view
            document.querySelectorAll(".term-link").forEach(link => {
                link.addEventListener("click", (event) => {
                    currentTermIndex = termPositions.findIndex(term => term.id === link.getAttribute("href").substring(1)) + 1; // Update current term index
                    event.preventDefault();
                    const termId = link.getAttribute("href").substring(1);
                    const termElement = document.getElementById(termId);
                    if (termElement) {
                        termElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                });
            });

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
            const highlightedTextContainer = document.getElementById("highlightedText");
            const issuesList = document.getElementById("issuesList");

            highlightedTextContainer.innerHTML = "";
            issuesList.innerHTML = "";

            if (result.error) {
                highlightedTextContainer.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
                return;
            }

            let highlightedText = result.input_text;
            let termCount = 0;
            const termPositions = [];

            result.analysis.forEach(issue => {
                const escapedTerm = escapeRegExp(issue.term);
                const regex = issue.term.includes(" ")
                    ? new RegExp(`${escapedTerm}`, "gi")
                    : new RegExp(`\\b${escapedTerm}\\b`, "gi");

                highlightedText = highlightedText.replace(regex, (match, offset) => {
                    termCount++;
                    const termId = `term-${termCount}`;
                    termPositions.push({ term: issue.term, feedback: issue.feedback, id: termId, position: offset });
                    return `<span id="${termId}" title="${issue.feedback}">${match}</span>`;
                });
            });

            // Sort terms by their positions in the input text
            termPositions.sort((a, b) => a.position - b.position);

            // Add sorted terms to the issues list
            termPositions.forEach(term => {
                const listItem = document.createElement("li");
                listItem.innerHTML = `<a href="#${term.id}" class="term-link"><strong>${term.term}</strong></a>: ${term.feedback}`;
                issuesList.appendChild(listItem);
            });

            highlightedTextContainer.innerHTML = `<p>${highlightedText}</p>`;
            resultContainer.style.display = "block";

            // Get all term elements
            termElements = document.querySelectorAll(".highlight");
            currentTermIndex = 0;

            // Add event listeners to the term links to scroll the term into view
            document.querySelectorAll(".term-link").forEach(link => {
                link.addEventListener("click", (event) => {
                    currentTermIndex = termPositions.findIndex(term => term.id === link.getAttribute("href").substring(1)) + 1; // Update current term index
                    event.preventDefault();
                    const termId = link.getAttribute("href").substring(1);
                    const termElement = document.getElementById(termId);
                    if (termElement) {
                        termElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                });
            });

        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred while uploading the file. Please try again.");
        }
    });

    // Next and previous term button functionality
    function scrollToNextTerm() {
        if (termElements.length > 0) {
            let nextTermIndex = (currentTermIndex % termElements.length) + 1;
            if (nextTermIndex > termElements.length) {
                nextTermIndex = 1;
            }
            console.log(`term index (next button): ${nextTermIndex}`);
            termElements[nextTermIndex - 1].scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function scrollToPrevTerm() {
        if (termElements.length > 0) {
            let prevTermIndex = (currentTermIndex - 2 + termElements.length) % termElements.length + 1;
            if (prevTermIndex < 1) {
                prevTermIndex = termElements.length;
            }
            console.log(`term index (previous button): ${prevTermIndex}`);
            termElements[prevTermIndex - 1].scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    document.getElementById("nextTermButton").addEventListener("click", scrollToNextTerm);
    document.getElementById("prevTermButton").addEventListener("click", scrollToPrevTerm);

    // Scroll to top button functionality
    function scrollToTop() {
        currentTermIndex = 0;
        console.log(`Scroll to top, reset index: ${currentTermIndex}`);

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.getElementById("topButton").addEventListener("click", scrollToTop);

    updateNavButtonsPosition(); // Initial position update on page load
});
