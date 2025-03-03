// Function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Global variable to store analysis results
let globalResults = null;

document.addEventListener("DOMContentLoaded", () => {
    let currentTermIndex = -1; // Start at -1 to indicate no term is selected initially
    let termElements = [];
    let sortedTerms = [];
    let issueListItems = [];
    
    // Get container elements
    const resultsSection = document.getElementById("resultsSection");
    const analyzedTextContainer = document.getElementById("analyzedText");
    const issuesList = document.getElementById("issuesList");
    const loadingIndicator = document.getElementById("loadingIndicator");
    
    // Buttons
    const analyzeButton = document.getElementById("analyzeButton");
    const uploadButton = document.getElementById("uploadButton");
    const copyResultsButton = document.getElementById("copyResultsButton");
    const downloadReportButton = document.getElementById("downloadReportButton");
    
    // Popup elements
    const feedbackPopup = document.getElementById("feedbackPopup");
    const closePopupBtn = document.getElementById("closePopup");
    const popupTerm = document.getElementById("popupTerm");
    const popupCategory = document.getElementById("popupCategory");
    const popupFeedback = document.getElementById("popupFeedback");
    const popupSource = document.getElementById("popupSource");

    // Toggle panel elements
    let togglePanelBtn = document.getElementById('toggleIssuesPanel');
    let issuesPanel = document.getElementById('issuesPanel');
    let issueCountSpan = document.getElementById('issueCount');
    let panelHideButton = document.getElementById('panelHideButton');
    let totalIssueCount = 0;
    
    // Initialize toggle button with right arrow icon
    if (togglePanelBtn) {
        togglePanelBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Show Issues';
    }

    // Ensure required elements exist
    if (!resultsSection || !analyzedTextContainer || !issuesList) {
        console.error("Required DOM elements not found");
    }
    
    // Initialize popup events
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', closeFeedbackPopup);
    }
    
    // Add keyboard event listener to close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && feedbackPopup && feedbackPopup.style.display === "flex") {
            closeFeedbackPopup();
        }
    });
    
    // Initialize panel toggle
    if (togglePanelBtn) {
        togglePanelBtn.addEventListener('click', toggleIssuesPanel);
    }
    
    // Initialize panel hide button
    if (panelHideButton) {
        panelHideButton.addEventListener('click', toggleIssuesPanel);
    }
    
    // Initialize copy and download buttons
    if (copyResultsButton) {
        copyResultsButton.addEventListener('click', copyResultsToClipboard);
    }
    
    if (downloadReportButton) {
        downloadReportButton.addEventListener('click', downloadAnalysisReport);
    }

    // Show popup with feedback
    function showFeedbackPopup(term, feedback, category, source) {
        if (!feedbackPopup || !popupTerm || !popupCategory || !popupFeedback || !popupSource) {
            console.error("Popup elements not found");
            return;
        }
        
        popupTerm.textContent = term;
        popupCategory.textContent = category || "General";
        popupFeedback.textContent = feedback;
        popupSource.textContent = `Source: ${source || "Internal"}`;
        
        // Make popup visible with flex display for centering
        feedbackPopup.style.display = "flex";
        
        // Add event listener to close when clicking outside
        document.addEventListener('mousedown', closePopupOnClickOutside);
        
        // Add event listener for Enter key to close the popup
        document.addEventListener('keydown', closePopupOnEnter);
    }
    
    // Close popup when pressing Enter
    function closePopupOnEnter(e) {
        if (e.key === 'Enter' && feedbackPopup && feedbackPopup.style.display === "flex") {
            closeFeedbackPopup();
            e.preventDefault();
        }
    }
    
    // Close popup when clicking outside
    function closePopupOnClickOutside(e) {
        if (feedbackPopup && feedbackPopup.style.display === "flex" && 
            !e.target.closest('.popup-content') && 
            e.target !== closePopupBtn) {
            closeFeedbackPopup();
        }
    }
    
    // Close popup function
    function closeFeedbackPopup() {
        if (feedbackPopup) {
            feedbackPopup.style.display = "none";
            document.removeEventListener('mousedown', closePopupOnClickOutside);
            document.removeEventListener('keydown', closePopupOnEnter);
        }
    }
    
    // Function to toggle issues panel
    function toggleIssuesPanel() {
        const resultsContainer = document.querySelector('.results-container');
        const isCurrentlyHidden = resultsContainer.classList.contains('issues-hidden');
        
        // Toggle the panel state
        resultsContainer.classList.toggle('issues-hidden');
        
        // Update toggle button based on state - immediately for better visual feedback
        if (!isCurrentlyHidden) {
            // Panel is now hidden
            togglePanelBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Show Issues';
            togglePanelBtn.title = 'Show issues panel';
            
            // Remove scroll control when panel is hidden
            if (window.innerWidth < 992) {
                const issuesListEl = document.getElementById('issuesList');
                if (issuesListEl) {
                    issuesListEl.removeEventListener('wheel', controlIssuesPanelScroll);
                    issuesListEl.removeEventListener('touchstart', handleTouchStart);
                    issuesListEl.removeEventListener('touchmove', handleTouchMove);
                }
            }
        } else {
            // Panel is now visible
            togglePanelBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Hide Issues';
            togglePanelBtn.title = 'Hide issues panel';
            
            // Initialize the close button when the panel becomes visible on mobile
            if (window.innerWidth < 992) {
                // Small delay before initializing mobile controls to let animation start
                setTimeout(() => {
                    initializePanelCloseButton();
                    setupIssuesPanelScrollControl();
                }, 50); // Consistent delay for mobile controls
            }
        }
        
        // Remove any event listeners for clicking outside
        document.removeEventListener('click', closeIssuesPanelOnClickOutside);
        
        // Add event listener for clicking outside on mobile when panel is visible
        if (window.innerWidth < 992 && isCurrentlyHidden) {
            // Wait until animation is mostly complete before adding the listener
            setTimeout(() => {
                document.addEventListener('click', closeIssuesPanelOnClickOutside);
            }, 300); // Wait for animation to be well underway
        }
        
        // Call matchPanelHeights after animation completes
        setTimeout(matchPanelHeights, 500); // Increased from 450ms to 500ms to match new CSS
        
        // Return focus to the toggle button after completing the action
        // This improves accessibility by returning focus to the control that initiated the action
        setTimeout(() => {
            if (!isCurrentlyHidden) {
                togglePanelBtn.focus();
            } else {
                panelHideButton.focus();
            }
        }, 550); // Increased slightly to ensure it happens after animation completes
    }

    // Close issues panel when clicking outside on mobile
    function closeIssuesPanelOnClickOutside(e) {
        const resultsContainer = document.querySelector('.results-container');
        const issuesPanel = document.getElementById('issuesPanel');
        
        // Only process if the issues panel is visible
        if (!resultsContainer.classList.contains('issues-hidden')) {
            // If click is outside the issues panel and not on the toggle button
            if (issuesPanel && !issuesPanel.contains(e.target) && e.target !== togglePanelBtn && !togglePanelBtn.contains(e.target)) {
                toggleIssuesPanel(); // Hide the panel
                
                // Prevent further processing
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    // Add a click event listener to the panel header close button
    function initializePanelCloseButton() {
        // Get the panel header
        const panelHeader = document.querySelector('.results-issues h4:first-child');
        const issuesPanel = document.querySelector('.results-issues');
        
        if (panelHeader && issuesPanel) {
            // Remove any existing close button
            const existingBtn = issuesPanel.querySelector('.panel-close-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            // Create a new close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'panel-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.setAttribute('aria-label', 'Close issues panel');
            closeBtn.title = 'Close issues panel';
            
            // Add click event listener
            closeBtn.addEventListener('click', function(e) {
                toggleIssuesPanel(); // Close the panel
                e.preventDefault();
                e.stopPropagation();
            });
            
            // Append the button to the issues panel (not the header)
            // This allows absolute positioning relative to the panel
            issuesPanel.appendChild(closeBtn);
        }
    }

    // Sort term elements by their position in the document
    function sortTermsByPosition(terms) {
        return Array.from(terms).sort((a, b) => {
            // Create a range to get position of each element
            const rangeA = document.createRange();
            rangeA.selectNode(a);
            const rangeB = document.createRange();
            rangeB.selectNode(b);
            
            return rangeA.compareBoundaryPoints(Range.START_TO_START, rangeB);
        });
    }

    // Function to match heights between analyzed text and issues panel
    function matchPanelHeights() {
        if (analyzedTextContainer && issuesPanel) {
            // Reset explicit height first to get the natural content height
            analyzedTextContainer.style.height = '';
            analyzedTextContainer.style.minHeight = '';
            
            // Also reset the parent container height
            const resultsTextContainer = document.querySelector('.results-text');
            if (resultsTextContainer) {
                resultsTextContainer.style.height = '';
                resultsTextContainer.style.minHeight = '';
            }
            
            // Get the actual content height
            const textHeight = analyzedTextContainer.scrollHeight;
            
            // Different handling based on viewport
            if (window.innerWidth >= 992) {
                // Desktop view - make container adapt to content
                let minHeight = Math.max(200, textHeight); // Reduced from 300 to 200
                analyzedTextContainer.style.minHeight = `${minHeight}px`;
                analyzedTextContainer.style.height = 'auto'; // Allow height to adjust to content
                issuesPanel.style.height = `${minHeight}px`;
                
                // Also update the parent container with flexible height
                if (resultsTextContainer) {
                    resultsTextContainer.style.minHeight = 'auto';
                    resultsTextContainer.style.height = 'auto';
                }
            } else {
                // Mobile view - maintain responsive heights
                let minHeight = Math.max(250, textHeight);
                analyzedTextContainer.style.minHeight = `${minHeight}px`;
                // Don't set fixed height in mobile to allow content to expand
                analyzedTextContainer.style.height = 'auto';
                
                // Ensure parent container has auto height in mobile
                if (resultsTextContainer) {
                    resultsTextContainer.style.minHeight = 'auto';
                    resultsTextContainer.style.height = 'auto';
                }
                
                // Make issues panel responsive to its content in mobile view
                const resultsContainer = document.querySelector('.results-container');
                if (resultsContainer && !resultsContainer.classList.contains('issues-hidden')) {
                    // Reset panel heights to let content determine size
                    issuesPanel.style.height = 'auto';
                    issuesPanel.style.minHeight = 'auto';
                    
                    // Ensure issues list is properly sized
                    const issuesList = document.getElementById('issuesList');
                    if (issuesList) {
                        issuesList.style.height = 'auto';
                        issuesList.style.minHeight = 'auto';
                        
                        // Get the viewport height and adjust max-height if needed
                        const viewportHeight = window.innerHeight;
                        const issuesListHeight = issuesList.scrollHeight;
                        
                        // If content is taller than viewport, cap at viewport height minus header space
                        if (issuesListHeight > viewportHeight - 120) {
                            issuesList.style.maxHeight = `${viewportHeight - 120}px`;
                        } else {
                            issuesList.style.maxHeight = 'none';
                        }
                    }
                }
            }
        }
    }

    // Process analysis results
    function processAnalysisResults(result) {
        console.log('Processing results:', result);
        
        if (!analyzedTextContainer || !issuesList) {
            console.error("Required result elements not found");
            return;
        }

        if (!result || !result.input_text || !result.analysis) {
            console.error("Invalid analysis result format", result);
            return;
        }

        // Clear previous results
        analyzedTextContainer.innerHTML = '';
        issuesList.innerHTML = '';
        
        // Ensure the container is ready for new content by removing ALL set heights
        analyzedTextContainer.style.height = '';
        analyzedTextContainer.style.minHeight = '';
        
        // Reset parent container too
        const resultsTextContainer = document.querySelector('.results-text');
        if (resultsTextContainer) {
            resultsTextContainer.style.height = '';
            resultsTextContainer.style.minHeight = '';
        }
        
        // Add confidence filter controls at the top of the issues panel
        const filterControls = document.createElement('div');
        filterControls.className = 'confidence-filter-controls';
        filterControls.innerHTML = `
            <div class="filter-label">Filter by confidence:</div>
            <div class="filter-options">
                <label class="filter-option">
                    <input type="checkbox" data-confidence="high" checked>
                    <span class="confidence-indicator high-confidence">High</span>
                </label>
                <label class="filter-option">
                    <input type="checkbox" data-confidence="medium" checked>
                    <span class="confidence-indicator medium-confidence">Medium</span>
                </label>
                <label class="filter-option">
                    <input type="checkbox" data-confidence="low" checked>
                    <span class="confidence-indicator low-confidence">Low</span>
                </label>
            </div>
        `;
        issuesList.appendChild(filterControls);
        
        // Add event listeners for filter checkboxes
        filterControls.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', filterIssuesByConfidence);
        });
        
        // Set the analyzed text
        analyzedTextContainer.innerHTML = result.input_text;
        
        // Reset counters and arrays
        termElements = [];
        sortedTerms = [];
        currentTermIndex = -1;
        totalIssueCount = 0;

        // Group issues by category
        const categorizedIssues = {};
        result.analysis.forEach(issue => {
            if (!categorizedIssues[issue.category]) {
                categorizedIssues[issue.category] = [];
            }
            categorizedIssues[issue.category].push(issue);
            totalIssueCount++;
        });

        // Create category sections and assign IDs to list items
        Object.entries(categorizedIssues).forEach(([category, issues]) => {
            const categoryHeader = document.createElement("h4");
            categoryHeader.textContent = category;
            issuesList.appendChild(categoryHeader);

            const issueList = document.createElement("ul");
            issues.forEach((issue, index) => {
                const listItem = document.createElement("li");
                // Add a data-term-id attribute for linking
                const termId = `term-${category.toLowerCase().replace(/\s+/g, '-')}-${index}`;
                listItem.dataset.termId = termId;
                listItem.id = `issue-${termId}`;
                
                // Store issue data for popup access
                listItem.dataset.term = issue.term;
                listItem.dataset.feedback = issue.feedback;
                listItem.dataset.category = issue.category || "General";
                listItem.dataset.source = issue.source || "Internal";
                
                // Add confidence class to list item
                if (issue.confidence !== undefined) {
                    if (issue.confidence < 0.3) {
                        listItem.classList.add('low-confidence-item');
                    } else if (issue.confidence < 0.7) {
                        listItem.classList.add('medium-confidence-item');
                    } else {
                        listItem.classList.add('high-confidence-item');
                    }
                    
                    // Store confidence data
                    listItem.dataset.confidence = issue.confidence;
                    listItem.dataset.contextNote = issue.context_note || "";
                }
                
                // Create confidence indicator
                let confidenceIndicator = '';
                if (issue.confidence !== undefined) {
                    const confidenceLevel = issue.confidence < 0.3 ? 'Low' : 
                                          (issue.confidence < 0.7 ? 'Medium' : 'High');
                    confidenceIndicator = `<span class="confidence-indicator ${confidenceLevel.toLowerCase()}-confidence">
                        ${confidenceLevel} confidence
                    </span>`;
                }
                
                listItem.innerHTML = `
                    <strong>"${issue.term}"</strong>: ${issue.feedback}
                    ${confidenceIndicator}
                    ${issue.context_note ? `<div class="context-note">${issue.context_note}</div>` : ''}
                    <br><small>Source: ${issue.source || "Internal"}</small>
                `;
                
                // Add click handler to scroll to the highlighted term
                listItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Find and highlight the term in text
                    const relatedTerms = document.querySelectorAll(`.highlight[data-term-id="${termId}"]`);
                    if (relatedTerms.length > 0) {
                        // Find the index in termElements
                        const termIndex = termElements.findIndex(t => t.dataset.termId === termId);
                        if (termIndex !== -1) {
                            currentTermIndex = termIndex;
                            
                            // On mobile, close the issues panel first, then scroll after animation completes
                            if (window.innerWidth < 992) {
                                const resultsContainer = document.querySelector('.results-container');
                                if (resultsContainer && !resultsContainer.classList.contains('issues-hidden')) {
                                    // First update focus without scrolling
                                    updateFocus(false);
                                    
                                    // Close the panel
                                    toggleIssuesPanel();
                                    
                                    // After panel closing animation completes, scroll the term into view
                                    setTimeout(() => {
                                        const currentTerm = termElements[currentTermIndex];
                                        if (currentTerm) {
                                            currentTerm.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'center'
                                            });
                                        }
                                    }, 550); // Increased to match other timings
                                }
                            } else {
                                // On desktop, update focus with scrolling immediately
                                updateFocus(true);
                                
                                // Extra scroll for better positioning
                                relatedTerms[0].scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });
                            }
                        }
                    }
                });
                
                issueList.appendChild(listItem);
            });
            issuesList.appendChild(issueList);
        });

        // Get all issue list items
        issueListItems = document.querySelectorAll('#issuesList li');
        
        // Get all highlighted terms, sort them by position, and reset the index
        const unsortedTerms = document.querySelectorAll(".highlight");
        termElements = Array.from(unsortedTerms);
        
        // Add term IDs to the highlighted terms
        termElements.forEach((term, index) => {
            // Find matching issue by term text
            const termText = term.textContent;
            const matchingIssue = Array.from(issueListItems).find(item => 
                item.querySelector('strong').textContent.includes(termText)
            );
            
            if (matchingIssue) {
                term.dataset.termId = matchingIssue.dataset.termId;
                // Add position indicator for debugging
                term.dataset.position = index;
            }
        });
        
        // Sort terms by position
        sortedTerms = sortTermsByPosition(termElements);
        
        // Show the results
        if (resultsSection) {
            // Add a fade-in effect to the results section
            resultsSection.style.opacity = "0";
            resultsSection.style.display = "block";
            resultsSection.style.transition = "opacity 0.5s cubic-bezier(0.23, 1, 0.32, 1)";
            
            // Trigger the fade-in
            setTimeout(() => {
                resultsSection.style.opacity = "1";
            }, 10);
            
            // Get the panel hide button
            const panelHideBtn = document.getElementById('panelHideButton');
            
            // Always hide the issues panel initially
            const resultsContainer = document.querySelector('.results-container');
            if (resultsContainer) {
                // Add class with a slight delay to allow initial render
                setTimeout(() => {
                    resultsContainer.classList.add('issues-hidden');
                    
                    // Update the toggle button
                    if (togglePanelBtn) {
                        togglePanelBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Show Issues';
                        togglePanelBtn.title = 'Show issues panel';
                    }
                    
                    // Set up correct display for panel hide button based on viewport
                    if (panelHideBtn) {
                        if (window.innerWidth >= 992) {
                            // Desktop view 
                            panelHideBtn.style.display = 'flex';
                        } else {
                            // Mobile view
                            panelHideBtn.style.display = 'none';
                        }
                    }
                }, 50); // Consistent short delay for better visual flow
            }
            
            // Setup appropriate controls based on viewport size
            if (window.innerWidth < 992) {
                // Mobile view setup
                initializePanelCloseButton();
            }
            
            // Give the DOM time to render before adjusting sizes
            setTimeout(() => {
                // Reset BOTH the height AND min-height of the analyzed text container
                // This is important for proper size calculation
                analyzedTextContainer.style.height = '';
                analyzedTextContainer.style.minHeight = '';
                
                // Reset parent container too
                if (resultsTextContainer) {
                    resultsTextContainer.style.height = '';
                    resultsTextContainer.style.minHeight = '';
                }
                
                // Ensure the container adjusts to its content
                const contentHeight = analyzedTextContainer.scrollHeight;
                
                // Different handling based on viewport
                if (window.innerWidth >= 992) {
                    // Desktop - adapt to content with minimum height
                    analyzedTextContainer.style.minHeight = Math.max(200, contentHeight) + 'px';
                    analyzedTextContainer.style.height = 'auto'; // Auto height allows content to determine size
                    
                    // Update parent container too
                    if (resultsTextContainer) {
                        resultsTextContainer.style.minHeight = 'auto';
                        resultsTextContainer.style.height = 'auto';
                    }
                } else {
                    // Mobile - use appropriate minimum height
                    analyzedTextContainer.style.minHeight = Math.max(250, contentHeight) + 'px'; 
                    // Don't set explicit height in mobile to allow for content expansion
                    analyzedTextContainer.style.height = 'auto';
                    
                    // Ensure parent container has auto height in mobile
                    if (resultsTextContainer) {
                        resultsTextContainer.style.minHeight = 'auto';
                        resultsTextContainer.style.height = 'auto';
                    }
                }
                
                // Match panel heights after sizing
                matchPanelHeights();
            }, 200); // Increased from 100ms to 200ms to ensure DOM updates are complete
        }
        
        // Add summary message if terms were found
        if (termElements.length > 0) {
            const summaryMessage = document.createElement('div');
            summaryMessage.className = 'summary-message';
            summaryMessage.innerHTML = `
                <p>Found ${termElements.length} potentially problematic terms. 
                Click on a term in the text to see details.</p>
            `;
            issuesList.insertBefore(summaryMessage, issuesList.firstChild);
        } else {
            const summaryMessage = document.createElement('div');
            summaryMessage.className = 'summary-message';
            summaryMessage.innerHTML = `
                <p>No problematic terms found in the analyzed text.</p>
            `;
            issuesList.appendChild(summaryMessage);
        }
        
        // Update issue count display
        if (issueCountSpan) {
            issueCountSpan.textContent = totalIssueCount;
        }

        // Initialize highlight listeners
        initializeHighlightListeners();

        // Match heights after content is loaded
        matchPanelHeights();
        
        // Add window resize event to maintain matching heights
        window.addEventListener('resize', matchPanelHeights);

        // After topics_data = get_topics();
        // Add topic analysis section if topics are available
        if (result.topics && Object.keys(result.topics).length > 0) {
            const topicsSection = document.createElement('div');
            topicsSection.className = 'topics-section';
            
            const topicsHeader = document.createElement('h3');
            topicsHeader.textContent = 'Detected Topics';
            topicsSection.appendChild(topicsHeader);
            
            const topicsList = document.createElement('div');
            topicsList.className = 'topics-list';
            
            // Convert to array for easier sorting
            const topicsArray = Object.entries(result.topics)
                .map(([topic, data]) => ({ topic, ...data }));
            
            topicsArray.forEach(topicData => {
                const topicItem = document.createElement('div');
                topicItem.className = 'topic-item';
                
                // Calculate width based on relevance (50% minimum, 100% maximum)
                const barWidth = 50 + (topicData.relevance * 50);
                
                topicItem.innerHTML = `
                    <div class="topic-name">${topicData.topic}</div>
                    <div class="topic-bar-container">
                        <div class="topic-bar" style="width: ${barWidth}%"></div>
                    </div>
                    <div class="topic-matches">${topicData.matches} matches</div>
                `;
                
                topicsList.appendChild(topicItem);
            });
            
            topicsSection.appendChild(topicsList);
            issuesList.appendChild(topicsSection);
        }
    }
    
    // Handle analyze button click
    document.getElementById("analyzeButton").addEventListener("click", async () => {
        const inputText = document.getElementById("inputText").value.trim();
        if (!inputText) {
            alert("Please enter some text to analyze.");
            return;
        }

        try {
            const response = await fetch("/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: inputText }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Store results globally
            globalResults = data;
            
            // Process results
            processAnalysisResults(data);
        } catch (error) {
            console.error("Analysis error:", error);
            alert(`Unable to analyze text: ${error.message}`);
            
            // Clear any partial results
            if (analyzedTextContainer) analyzedTextContainer.innerHTML = "";
            if (issuesList) issuesList.innerHTML = "";
            if (resultsSection) resultsSection.style.display = "none";
        }
    });

    // Handle upload button click
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
            const response = await fetch("/upload", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Store results globally
            globalResults = result;
            
            // Process results
            processAnalysisResults(result);
        } catch (error) {
            console.error("Error:", error);
            alert(`An error occurred while uploading the file: ${error.message}`);
            
            // Clear any partial results
            if (analyzedTextContainer) analyzedTextContainer.innerHTML = "";
            if (issuesList) issuesList.innerHTML = "";
            if (resultsSection) resultsSection.style.display = "none";
        }
    });
    
    // Update focus of terms
    function updateFocus(shouldScroll = true) {
        // Remove focus from all terms and issues
        termElements.forEach(el => {
            el.classList.remove('focused');
            el.classList.remove('active');
        });
        
        issueListItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // Add focus to current term if valid index exists
        if (currentTermIndex >= 0 && currentTermIndex < termElements.length) {
            const currentTerm = termElements[currentTermIndex];
            currentTerm.classList.add('focused');
            currentTerm.classList.add('active');
            
            // Scroll the current term into view if shouldScroll is true
            if (shouldScroll) {
                currentTerm.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
            
            // Find and highlight the corresponding issue
            const termId = currentTerm.dataset.termId;
            if (termId) {
                const relatedIssue = document.querySelector(`#issue-${termId}`);
                if (relatedIssue) {
                    relatedIssue.classList.add('active');
                }
            }
        }
    }

    // Initialize highlight listeners
    function initializeHighlightListeners() {
        const terms = document.querySelectorAll('.highlight');
        
        terms.forEach((term) => {
            term.addEventListener('click', (e) => {
                // Get the term's feedback data
                const feedback = term.getAttribute('data-feedback');
                const category = term.getAttribute('data-category') || 'General';
                const source = term.getAttribute('data-source') || 'Internal';
                
                if (feedback) {
                    // Show popup with this term's data
                    showFeedbackPopup(
                        term.textContent,
                        feedback,
                        category,
                        source
                    );
                    
                    // Find the index of this term
                    const termIndex = termElements.indexOf(term);
                    if (termIndex !== -1) {
                        currentTermIndex = termIndex;
                        // Pass false to not scroll when directly clicking a term
                        updateFocus(false);
                    }
                }
            });
        });
    }

    // Function to copy results to clipboard
    function copyResultsToClipboard() {
        if (!globalResults) return;
        
        let copyText = "DEI Content Analysis Results\n\n";
        copyText += "Issues Found: " + totalIssueCount + "\n\n";
        
        if (globalResults.problematic_terms && globalResults.problematic_terms.length > 0) {
            copyText += "Problematic Terms:\n";
            globalResults.problematic_terms.forEach((term, index) => {
                copyText += `${index + 1}. "${term.term}" (${term.category || "General"})\n`;
                copyText += `   Feedback: ${term.feedback}\n`;
                if (term.source) copyText += `   Source: ${term.source}\n`;
                copyText += "\n";
            });
        }
        
        navigator.clipboard.writeText(copyText)
            .then(() => {
                // Show a temporary success message
                const button = copyResultsButton;
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                button.style.backgroundColor = '#10b981'; // Success green
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.backgroundColor = '';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy to clipboard.');
            });
    }
    
    // Function to download analysis report
    function downloadAnalysisReport() {
        if (!globalResults) return;
        
        let reportText = "DEI Content Analysis Report\n\n";
        reportText += "Date: " + new Date().toLocaleString() + "\n";
        reportText += "Issues Found: " + totalIssueCount + "\n\n";
        
        if (globalResults.problematic_terms && globalResults.problematic_terms.length > 0) {
            reportText += "Problematic Terms:\n";
            globalResults.problematic_terms.forEach((term, index) => {
                reportText += `${index + 1}. "${term.term}" (${term.category || "General"})\n`;
                reportText += `   Feedback: ${term.feedback}\n`;
                if (term.source) reportText += `   Source: ${term.source}\n`;
                reportText += "\n";
            });
        }
        
        reportText += "Analyzed Text:\n";
        reportText += globalResults.original_text + "\n\n";
        
        // Create a blob and download link
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dei-analysis-report.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Show loading indicator
    function showLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }
    
    // Hide loading indicator
    function hideLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    // Analyze text function
    async function analyzeText() {
        const inputText = document.getElementById("inputText").value.trim();
        
        if (!inputText) {
            alert("Please enter some text to analyze.");
            return;
        }
        
        // Show loading indicator
        showLoading();
        
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: inputText })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Hide loading and process results
            hideLoading();
            processAnalysisResults(result);
            
        } catch (error) {
            console.error("Error analyzing text:", error);
            hideLoading();
            alert("Failed to analyze text. Please try again.");
        }
    }
    
    // Upload and analyze function
    async function uploadAndAnalyze() {
        const fileInput = document.getElementById("fileInput");
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Please select a file to upload.");
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        // Show loading indicator
        showLoading();
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Hide loading and process results
            hideLoading();
            processAnalysisResults(result);
            
        } catch (error) {
            console.error("Error uploading file:", error);
            hideLoading();
            alert("Failed to upload and analyze file. Please try again.");
        }
    }

    // Add event listeners for analyze and upload buttons
    if (analyzeButton) {
        analyzeButton.addEventListener("click", analyzeText);
    }
    
    if (uploadButton) {
        uploadButton.addEventListener("click", uploadAndAnalyze);
    }
    
    // Add responsive event listeners
    window.addEventListener('resize', () => {
        // Clear any previously applied height styles immediately
        if (analyzedTextContainer) {
            // Clear both height and min-height immediately for faster response
            analyzedTextContainer.style.height = '';
            analyzedTextContainer.style.minHeight = '';
        }
        
        // Also immediately reset the parent container's height
        const resultsTextContainer = document.querySelector('.results-text');
        if (resultsTextContainer) {
            resultsTextContainer.style.height = '';
            resultsTextContainer.style.minHeight = '';
        }
        
        // Match panel heights on window resize with small delay to ensure
        // all layout changes have happened first
        clearTimeout(window.resizeTimer); // Clear previous timeout
        window.resizeTimer = setTimeout(() => {
            if (analyzedTextContainer) {
                // Reset height and min-height before calculating new values
                analyzedTextContainer.style.height = '';
                analyzedTextContainer.style.minHeight = '';
            }
            
            // Also reset the parent container again before recalculation
            if (resultsTextContainer) {
                resultsTextContainer.style.height = '';
                resultsTextContainer.style.minHeight = '';
            }
            
            // Reset issues panel height for proper recalculation
            if (issuesPanel) {
                issuesPanel.style.height = '';
                issuesPanel.style.minHeight = '';
                
                // Reset the issues list height when in mobile view
                if (window.innerWidth < 992) {
                    const issuesList = document.getElementById('issuesList');
                    if (issuesList) {
                        issuesList.style.height = 'auto';
                        issuesList.style.minHeight = 'auto';
                        issuesList.style.maxHeight = '';
                    }
                }
            }
            
            matchPanelHeights();
            
            // Additional responsive handling...
            if (window.innerWidth >= 992) {
                // In desktop view, ensure panel hide button is visible
                const panelHideBtn = document.getElementById('panelHideButton');
                if (panelHideBtn) {
                    panelHideBtn.style.display = 'flex';
                }
                
                // Remove panel close button in desktop view
                const panelCloseBtn = document.querySelector('.panel-close-btn');
                if (panelCloseBtn) {
                    panelCloseBtn.remove();
                }
                
                // Ensure analyzed text container has appropriate desktop styles
                if (analyzedTextContainer) {
                    analyzedTextContainer.style.minHeight = '200px';
                    analyzedTextContainer.style.height = 'auto';
                }
            } else if (window.innerWidth < 992) {
                // Mobile view handling...
                if (!document.querySelector('.results-container').classList.contains('issues-hidden')) {
                    // Panel is visible, initialize mobile close button
                    initializePanelCloseButton();
                    // Setup scroll control when resizing to mobile view
                    setupIssuesPanelScrollControl();
                }
                
                // Hide the panel hide button in mobile view
                const panelHideBtn = document.getElementById('panelHideButton');
                if (panelHideBtn) {
                    panelHideBtn.style.display = 'none';
                }
                
                // Ensure analyzed text container has appropriate mobile styles
                if (analyzedTextContainer) {
                    analyzedTextContainer.style.minHeight = '250px';
                    analyzedTextContainer.style.height = 'auto';
                }
            }
        }, 150); // Increased from 100ms to 150ms to ensure layout has time to settle
    });
    
    // Keyboard navigation for accessibility
    document.addEventListener('keydown', (e) => {
        // Only if we have results and terms
        if (!globalResults || !sortedTerms.length) return;
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            // Move to next term
            if (currentTermIndex < sortedTerms.length - 1) {
                currentTermIndex++;
                // Keep scrolling for keyboard navigation (pass true)
                updateFocus(true);
                e.preventDefault(); // Prevent default scrolling behavior
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            // Move to previous term
            if (currentTermIndex > 0) {
                currentTermIndex--;
                // Keep scrolling for keyboard navigation (pass true)
                updateFocus(true);
                e.preventDefault(); // Prevent default scrolling behavior
            }
        } else if (e.key === 'Enter' && currentTermIndex >= 0) {
            // Show popup for current term
            const term = sortedTerms[currentTermIndex];
            showFeedbackPopup(term.textContent, 
                               term.dataset.feedback, 
                               term.dataset.category, 
                               term.dataset.source);
            e.preventDefault();
        }
    });

    // Control scrolling behavior for issues panel in mobile view
    function setupIssuesPanelScrollControl() {
        if (window.innerWidth >= 992) return; // Only apply for mobile views
        
        const issuesListEl = document.getElementById('issuesList');
        if (!issuesListEl) return;
        
        // Remove any existing listeners first to avoid duplicates
        issuesListEl.removeEventListener('wheel', controlIssuesPanelScroll);
        issuesListEl.removeEventListener('touchstart', handleTouchStart);
        issuesListEl.removeEventListener('touchmove', handleTouchMove);
        
        // Add wheel event listener for mouse/trackpad
        issuesListEl.addEventListener('wheel', controlIssuesPanelScroll, { passive: false });
        
        // Add touch event listeners for mobile devices
        issuesListEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        issuesListEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    let touchStartY = 0;
    
    // Handle touch start event
    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
    }
    
    // Handle touch move event
    function handleTouchMove(e) {
        if (!e.target.closest('#issuesList')) return;
        
        const touchY = e.touches[0].clientY;
        const issuesListEl = document.getElementById('issuesList');
        const scrollTop = issuesListEl.scrollTop;
        const scrollHeight = issuesListEl.scrollHeight;
        const clientHeight = issuesListEl.clientHeight;
        
        // Check if at the top or bottom of the scroll area
        const isAtTop = scrollTop <= 0 && touchY > touchStartY;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight && touchY < touchStartY;
        
        // Prevent default scroll behavior only at the boundaries
        if (isAtTop || isAtBottom) {
            e.preventDefault();
        }
        
        touchStartY = touchY;
    }
    
    // Handle wheel/trackpad scrolling
    function controlIssuesPanelScroll(e) {
        const issuesListEl = this;
        const scrollTop = issuesListEl.scrollTop;
        const scrollHeight = issuesListEl.scrollHeight;
        const clientHeight = issuesListEl.clientHeight;
        
        // Scrolling up and at the top
        if (e.deltaY < 0 && scrollTop <= 0) {
            e.preventDefault();
        }
        
        // Scrolling down and at the bottom
        if (e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight) {
            e.preventDefault();
        }
    }

    // Add function to filter issues by confidence
    function filterIssuesByConfidence() {
        // Get selected confidence levels
        const selectedLevels = [];
        document.querySelectorAll('.confidence-filter-controls input[type="checkbox"]:checked').forEach(checkbox => {
            selectedLevels.push(checkbox.dataset.confidence);
        });
        
        // Filter list items based on confidence class
        const issueItems = document.querySelectorAll('#issuesList li');
        issueItems.forEach(item => {
            let shouldShow = false;
            
            if (item.classList.contains('high-confidence-item') && selectedLevels.includes('high')) {
                shouldShow = true;
            } else if (item.classList.contains('medium-confidence-item') && selectedLevels.includes('medium')) {
                shouldShow = true;
            } else if (item.classList.contains('low-confidence-item') && selectedLevels.includes('low')) {
                shouldShow = true;
            }
            
            item.style.display = shouldShow ? '' : 'none';
        });
        
        // Also filter highlights in the text
        const highlights = document.querySelectorAll('.highlight');
        highlights.forEach(highlight => {
            let shouldShow = false;
            
            if (highlight.classList.contains('high-confidence') && selectedLevels.includes('high')) {
                shouldShow = true;
            } else if (highlight.classList.contains('medium-confidence') && selectedLevels.includes('medium')) {
                shouldShow = true;
            } else if (highlight.classList.contains('low-confidence') && selectedLevels.includes('low')) {
                shouldShow = true;
            }
            
            // For highlights, we don't want to fully hide them, just make them less visible
            highlight.style.opacity = shouldShow ? '1' : '0.25';
            highlight.style.pointerEvents = shouldShow ? 'auto' : 'none';
        });
    }
});
