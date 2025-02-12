// Function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

document.addEventListener("DOMContentLoaded", () => {
    let currentTermIndex = 0;
    let termElements = [];
    const resultContainer = document.getElementById("result");
    const feedbackPanel = document.getElementById("feedbackPanel");
    const feedbackContent = document.getElementById("feedbackContent");

    // Ensure required elements exist
    if (!resultContainer || !feedbackPanel || !feedbackContent) {
        console.error("Required DOM elements not found");
        return;
    }

    function updateNavButtonsPosition() {
        const navButtons = document.querySelector(".nav-controls");
        if (!navButtons) return;
        
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

    window.addEventListener("resize", () => {
        if (document.getElementById("result").style.display === "block") {
            updateNavButtonsPosition();
        }
    });
    window.addEventListener("scroll", () => {
        updateNavButtonsPosition();
        updateCurrentTermIndex();
    });

    async function processAnalysisResults(result) {
        const highlightedTextContainer = document.getElementById("highlightedText");
        const issuesList = document.getElementById("issuesList");
        
        if (!highlightedTextContainer || !issuesList) {
            console.error("Required result elements not found");
            return;
        }

        highlightedTextContainer.innerHTML = result.input_text;
        issuesList.innerHTML = "";

        // Group issues by category
        const categorizedIssues = {};
        result.analysis.forEach(issue => {
            if (!categorizedIssues[issue.category]) {
                categorizedIssues[issue.category] = [];
            }
            categorizedIssues[issue.category].push(issue);
        });

        // Create category sections
        Object.entries(categorizedIssues).forEach(([category, issues]) => {
            const categoryHeader = document.createElement("h4");
            categoryHeader.textContent = category;
            issuesList.appendChild(categoryHeader);

            const issueList = document.createElement("ul");
            issues.forEach(issue => {
                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <strong>"${issue.term}"</strong>: ${issue.feedback}
                    <br><small>Source: ${issue.source}</small>
                `;
                issueList.appendChild(listItem);
            });
            issuesList.appendChild(issueList);
        });

        // Initialize term navigation
        termElements = document.querySelectorAll(".highlight");
        currentTermIndex = 0;

        // Show the results and feedback panel
        resultContainer.style.display = "block";
        feedbackPanel.classList.add('visible');

        // Set initial feedback panel content
        feedbackContent.innerHTML = `
            <h4>Navigation Instructions</h4>
            <p>Click on any highlighted term to see detailed feedback.</p>
            <p>Use the navigation buttons above to move between terms.</p>
        `;

        // Initialize highlight listeners
        initializeHighlightListeners();

        // Update positions after elements are visible
        setTimeout(() => {
            updateNavButtonsPosition();
        }, 100);
    }

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
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            await processAnalysisResults(result);
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
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            await processAnalysisResults(result);
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

    function showFeedback(term, feedback, category, source) {
        const feedbackPanel = document.getElementById('feedbackPanel');
        const feedbackContent = document.getElementById('feedbackContent');
        
        // Show the panel
        feedbackPanel.classList.add('visible');
        
        // Update content
        feedbackContent.innerHTML = `
            <h4>Term: "${term.textContent}"</h4>
            <p><strong>Feedback:</strong> ${feedback}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Source:</strong> ${source}</p>
        `;
        
        // Adjust panel height based on content
        const contentHeight = feedbackContent.scrollHeight;
        feedbackPanel.style.maxHeight = `${Math.min(contentHeight + 100, window.innerHeight * 0.3)}px`;
        
        // Remove previous highlights
        document.querySelectorAll('.highlight.active').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add highlight to current term
        term.classList.add('active');
    }

    function initializeHighlightListeners() {
        document.querySelectorAll('.highlight').forEach(element => {
            element.addEventListener('click', (e) => {
                const feedback = e.target.dataset.feedback;
                const category = e.target.dataset.category;
                const source = e.target.dataset.source;
                showFeedback(e.target, feedback, category, source);
            });
        });
    }

    // Update existing navigation functions to show feedback
    function scrollToTerm(index) {
        if (!termElements.length) return;
        
        currentTermIndex = ((index % termElements.length) + termElements.length) % termElements.length;
        const currentTerm = termElements[currentTermIndex];
        
        currentTerm.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Show feedback for the current term
        const { feedback, category, source } = currentTerm.dataset;
        showFeedback(currentTerm, feedback, category, source);
    }
});
