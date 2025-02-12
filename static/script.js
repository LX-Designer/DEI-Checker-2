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
            throw new Error("Required result elements not found");
        }

        if (!result || !result.input_text || !result.analysis) {
            console.error("Invalid analysis result format", result);
            throw new Error("Invalid response from server");
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

        // Initialize term navigation with -1 to start before first term
        termElements = document.querySelectorAll(".highlight");
        currentTermIndex = -1;

        // Show the results and feedback panel
        resultContainer.style.display = "block";
        feedbackPanel.classList.add('visible');

        // Set initial feedback panel content
        feedbackContent.innerHTML = `
            <h4>Navigation Instructions</h4>
            <p>Found ${termElements.length} highlighted terms.</p>
            <p>Use ↑/↓ arrow keys or navigation buttons to move between terms.</p>
            <p>Click any highlighted term to see its feedback.</p>
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
        const resultContainer = document.getElementById("result");
        const highlightedTextContainer = document.getElementById("highlightedText");
        const issuesList = document.getElementById("issuesList");

        // Reset previous results
        highlightedTextContainer.innerHTML = "";
        issuesList.innerHTML = "";
        resultContainer.style.display = "none";

        if (!inputText) {
            alert("Please enter some text before analyzing.");
            return;
        }

        try {
            const response = await fetch("http://127.0.0.1:5000/analyze", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ text: inputText })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Server error (${response.status})`);
            }
            
            if (result.error) {
                throw new Error(result.error);
            }

            if (!result.input_text || !result.analysis) {
                throw new Error("Invalid response format from server");
            }
            
            await processAnalysisResults(result);
        } catch (error) {
            console.error("Analysis error:", error);
            alert(`Unable to analyze text: ${error.message}`);
            
            // Clear any partial results
            highlightedTextContainer.innerHTML = "";
            issuesList.innerHTML = "";
            resultContainer.style.display = "none";
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

    function updateFocus() {
        // Remove focus from all terms
        termElements.forEach(el => el.classList.remove('focused'));
        
        // Add focus to current term if valid index exists
        if (currentTermIndex >= 0 && currentTermIndex < termElements.length) {
            termElements[currentTermIndex].classList.add('focused');
        }
    }

    // Next and previous term button functionality
    function navigateToTerm(direction) {
        if (!termElements.length) return;
        
        if (direction === 'next') {
            currentTermIndex = (currentTermIndex + 1) % termElements.length;
        } else if (direction === 'prev') {
            currentTermIndex = (currentTermIndex - 1 + termElements.length) % termElements.length;
        }
        
        const currentTerm = termElements[currentTermIndex];
        currentTerm.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Update focus and show feedback
        updateFocus();
        const { feedback, category, source } = currentTerm.dataset;
        showFeedback(currentTerm, feedback, category, source);
    }

    // Update the existing button handlers
    document.getElementById("nextTermButton").addEventListener("click", () => navigateToTerm('next'));
    document.getElementById("prevTermButton").addEventListener("click", () => navigateToTerm('prev'));

    // Add keyboard navigation
    document.addEventListener("keydown", (e) => {
        if (!resultContainer.style.display === "block") return;
        
        switch(e.key) {
            case "ArrowDown":
                e.preventDefault();
                navigateToTerm('next');
                break;
            case "ArrowUp":
                e.preventDefault();
                navigateToTerm('prev');
                break;
            case "Home":
                e.preventDefault();
                if (termElements.length) {
                    currentTermIndex = 0;
                    const firstTerm = termElements[0];
                    firstTerm.scrollIntoView({ behavior: "smooth", block: "center" });
                    const { feedback, category, source } = firstTerm.dataset;
                    showFeedback(firstTerm, feedback, category, source);
                }
                break;
            case "End":
                e.preventDefault();
                if (termElements.length) {
                    currentTermIndex = termElements.length - 1;
                    const lastTerm = termElements[currentTermIndex];
                    lastTerm.scrollIntoView({ behavior: "smooth", block: "center" });
                    const { feedback, category, source } = lastTerm.dataset;
                    showFeedback(lastTerm, feedback, category, source);
                }
                break;
        }
    });

    // Scroll to top button functionality
    function scrollToTop() {
        currentTermIndex = -1; // Reset index
        updateFocus(); // Clear focus
        window.scrollTo({ top: 0, behavior: "smooth" });
        
        // Reset feedback panel
        feedbackContent.innerHTML = `
            <h4>Navigation Instructions</h4>
            <p>Found ${termElements.length} highlighted terms.</p>
            <p>Use ↑/↓ arrow keys or navigation buttons to move between terms.</p>
            <p>Click any highlighted term to see its feedback.</p>
        `;
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
        
        // Remove previous highlights and focus
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('active', 'focused');
        });
        
        // Add highlight and focus to current term
        term.classList.add('active', 'focused');
        
        // Update currentTermIndex to match the clicked term
        currentTermIndex = Array.from(termElements).indexOf(term);
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
