// BigQuery Release Pulse - Client Logic
document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const refreshBtn = document.getElementById("refreshBtn");
    const refreshIcon = document.getElementById("refreshIcon");
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("statusText");
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const filterChips = document.getElementById("filterChips");
    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    const errorMessage = document.getElementById("errorMessage");
    const emptyState = document.getElementById("emptyState");
    const releaseNotesFeed = document.getElementById("releaseNotesFeed");
    const retryBtn = document.getElementById("retryBtn");
    const themeToggle = document.getElementById("themeToggle");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    
    // Composer Elements
    const tweetTextArea = document.getElementById("tweetTextArea");
    const tweetPlaceholder = document.getElementById("tweetPlaceholder");
    const textareaWrapper = tweetTextArea.parentElement;
    const selectedCountBadge = document.getElementById("selectedCountBadge");
    const charCountLabel = document.getElementById("charCountLabel");
    const charProgressRing = document.getElementById("charProgressRing");
    const copyTweetBtn = document.getElementById("copyTweetBtn");
    const clearComposerBtn = document.getElementById("clearComposerBtn");
    const tweetBtn = document.getElementById("tweetBtn");
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    // State Variables
    let allReleaseNotes = [];
    let selectedUpdates = new Map(); // Map of updateId -> update details
    let currentFilter = "all";
    let currentSearch = "";
    
    // Character Limit Constant
    const TWEET_LIMIT = 280;
    
    // SVG Progress Ring calculations
    const ringRadius = 15;
    const ringCircumference = 2 * Math.PI * ringRadius; // ~94.247
    
    // Initialize Progress Ring
    if (charProgressRing) {
        charProgressRing.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
        charProgressRing.style.strokeDashoffset = ringCircumference;
    }

    // Initialize Theme from localStorage
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.body.classList.remove("light-theme");
        if (themeToggle) themeToggle.checked = false;
    }

    // Load initial feed data
    fetchReleaseNotes(false);

    // Event Listeners
    refreshBtn.addEventListener("click", () => fetchReleaseNotes(true));
    retryBtn.addEventListener("click", () => fetchReleaseNotes(true));

    // Theme Toggle Listener
    if (themeToggle) {
        themeToggle.addEventListener("change", () => {
            if (themeToggle.checked) {
                document.body.classList.add("light-theme");
                localStorage.setItem("theme", "light");
            } else {
                document.body.classList.remove("light-theme");
                localStorage.setItem("theme", "dark");
            }
        });
    }

    // Export CSV Listener
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", () => {
            exportFeedToCSV();
        });
    }
    
    // Search input
    searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = currentSearch ? "block" : "none";
        renderNotes();
    });

    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        currentSearch = "";
        clearSearchBtn.style.display = "none";
        searchInput.focus();
        renderNotes();
    });

    // Filter Chips selection
    filterChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        
        // Remove active class from all and add to current
        filterChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        
        currentFilter = chip.dataset.type;
        renderNotes();
    });

    // Composer inputs and actions
    tweetTextArea.addEventListener("input", () => {
        updateComposerUI();
    });

    clearComposerBtn.addEventListener("click", () => {
        clearComposer();
    });

    copyTweetBtn.addEventListener("click", () => {
        const text = tweetTextArea.value;
        if (!text) return;
        
        navigator.clipboard.writeText(text)
            .then(() => showToast("<i class='fa-regular fa-circle-check'></i> Copied tweet to clipboard!"))
            .catch(() => showToast("<i class='fa-regular fa-circle-xmark'></i> Failed to copy."));
    });

    tweetBtn.addEventListener("click", () => {
        const text = tweetTextArea.value;
        if (!text) return;
        
        const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
    });

    // ----------------- Core Functions -----------------
    
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoading(true);
        
        // Update header indicator
        statusDot.className = "status-dot loading";
        statusText.innerText = "Syncing feed...";
        
        try {
            const endpoint = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            allReleaseNotes = result.data || [];
            
            // Success indicator
            statusDot.className = "status-dot green";
            statusText.innerText = result.source === "cache" || result.source === "stale_cache" 
                ? "Feed (cached)" 
                : "Feed Connected";
                
            if (forceRefresh) {
                showToast("<i class='fa-solid fa-arrows-rotate'></i> Feed refreshed successfully!");
            }
            
            renderNotes();
            
        } catch (error) {
            console.error("Fetch release notes failed:", error);
            statusDot.className = "status-dot red";
            statusText.innerText = "Connection Failed";
            
            loadingState.style.display = "none";
            releaseNotesFeed.style.display = "none";
            emptyState.style.display = "none";
            
            errorMessage.innerText = error.message || "Failed to parse release feed.";
            errorState.style.display = "flex";
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            refreshBtn.disabled = true;
            refreshIcon.classList.add("spin");
            loadingState.style.display = "flex";
            errorState.style.display = "none";
            emptyState.style.display = "none";
            releaseNotesFeed.style.display = "none";
        } else {
            refreshBtn.disabled = false;
            refreshIcon.classList.remove("spin");
            loadingState.style.display = "none";
        }
    }

    function renderNotes() {
        releaseNotesFeed.innerHTML = "";
        
        if (!allReleaseNotes || allReleaseNotes.length === 0) {
            emptyState.style.display = "flex";
            releaseNotesFeed.style.display = "none";
            return;
        }

        let totalRendered = 0;

        allReleaseNotes.forEach(entry => {
            // Filter and Search updates inside this date entry
            const filteredUpdates = entry.updates.filter(update => {
                // Type Filter
                if (currentFilter !== "all" && update.type.toLowerCase() !== currentFilter.toLowerCase()) {
                    return false;
                }
                
                // Search query matching
                if (currentSearch) {
                    const textContent = (update.type + " " + update.plain_text).toLowerCase();
                    if (!textContent.includes(currentSearch)) {
                        return false;
                    }
                }
                
                return true;
            });

            if (filteredUpdates.length === 0) return; // Skip dates with no updates matching filters

            totalRendered += filteredUpdates.length;

            // Create Date Group
            const dateGroup = document.createElement("div");
            dateGroup.className = "date-group";

            const dateHeader = document.createElement("div");
            dateHeader.className = "date-header";
            
            const dateTitle = document.createElement("h3");
            dateTitle.className = "date-title";
            dateTitle.innerText = entry.date;
            
            const dateLine = document.createElement("div");
            dateLine.className = "date-line";

            dateHeader.appendChild(dateTitle);
            dateHeader.appendChild(dateLine);
            dateGroup.appendChild(dateHeader);

            // Create cards for each update in this date
            filteredUpdates.forEach(update => {
                const card = document.createElement("article");
                const cardTypeClass = `card-${update.type.toLowerCase()}`;
                
                // Ensure default styling for unmapped types
                const supportedTypes = ['feature', 'announcement', 'issue', 'deprecated'];
                const appliedTypeClass = supportedTypes.includes(update.type.toLowerCase()) ? cardTypeClass : 'card-general';
                const isSelected = selectedUpdates.has(update.id);
                
                card.className = `update-card ${appliedTypeClass} ${isSelected ? 'selected' : ''}`;
                card.dataset.id = update.id;
                
                // Create checkbox block
                const selectControl = document.createElement("div");
                selectControl.className = "card-select-control";
                
                const customCheckbox = document.createElement("div");
                customCheckbox.className = "custom-checkbox";
                customCheckbox.innerHTML = '<i class="fa-solid fa-check"></i>';
                selectControl.appendChild(customCheckbox);
                card.appendChild(selectControl);

                // Create Content block
                const contentSection = document.createElement("div");
                contentSection.className = "card-content-section";

                // Meta row (Badge and Date link)
                const cardMeta = document.createElement("div");
                cardMeta.className = "card-meta";

                const badgeRow = document.createElement("div");
                badgeRow.className = "card-badge-row";

                const badge = document.createElement("span");
                const badgeTypeClass = `badge-${update.type.toLowerCase()}`;
                const appliedBadgeClass = supportedTypes.includes(update.type.toLowerCase()) ? badgeTypeClass : 'badge-general';
                badge.className = `update-type-badge ${appliedBadgeClass}`;
                
                // Add icons to badges
                let badgeIcon = '<i class="fa-solid fa-circle-nodes"></i> ';
                if (update.type.toLowerCase() === 'feature') badgeIcon = '<i class="fa-solid fa-star"></i> ';
                if (update.type.toLowerCase() === 'announcement') badgeIcon = '<i class="fa-solid fa-bullhorn"></i> ';
                if (update.type.toLowerCase() === 'issue') badgeIcon = '<i class="fa-solid fa-circle-exclamation"></i> ';
                if (update.type.toLowerCase() === 'deprecated') badgeIcon = '<i class="fa-solid fa-ban"></i> ';
                
                badge.innerHTML = `${badgeIcon} ${update.type}`;
                badgeRow.appendChild(badge);
                cardMeta.appendChild(badgeRow);

                const dateLink = document.createElement("a");
                dateLink.className = "card-date";
                dateLink.href = entry.link;
                dateLink.target = "_blank";
                dateLink.title = "View in Google Cloud docs";
                dateLink.innerHTML = `${entry.date} <i class="fa-solid fa-up-right-from-square"></i>`;
                cardMeta.appendChild(dateLink);
                
                contentSection.appendChild(cardMeta);

                // HTML content body
                const bodyHtml = document.createElement("div");
                bodyHtml.className = "update-body-html";
                bodyHtml.innerHTML = update.html;
                contentSection.appendChild(bodyHtml);

                // Quick actions
                const actionsWrapper = document.createElement("div");
                actionsWrapper.className = "card-actions-wrapper";

                // Copy card content button
                const copyBtn = document.createElement("button");
                copyBtn.className = "card-action-btn copy-card-btn";
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Update';
                copyBtn.title = "Copy this update to clipboard";
                
                copyBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // Avoid triggering card-click
                    const tag = `[BigQuery ${update.type}]`;
                    const dateShort = entry.date.replace(/, \d{4}/, '');
                    const textToCopy = `${tag} (${dateShort}):\n${update.plain_text}\n\nRead more: ${entry.link}`;
                    
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => showToast("<i class='fa-regular fa-circle-check'></i> Copied update to clipboard!"))
                        .catch(() => showToast("<i class='fa-regular fa-circle-xmark'></i> Failed to copy."));
                });

                const quickTweet = document.createElement("button");
                quickTweet.className = `quick-tweet-btn ${isSelected ? 'added' : ''}`;
                quickTweet.innerHTML = isSelected 
                    ? '<i class="fa-solid fa-minus"></i> Deselect' 
                    : '<i class="fa-brands fa-x-twitter"></i> Select to Tweet';
                
                quickTweet.addEventListener("click", (e) => {
                    e.stopPropagation(); // Avoid triggering card-click twice
                    toggleUpdateSelection(update, entry.date, entry.link, card);
                });
                
                actionsWrapper.appendChild(copyBtn);
                actionsWrapper.appendChild(quickTweet);
                contentSection.appendChild(actionsWrapper);

                card.appendChild(contentSection);

                // Card Click selects/deselects update
                card.addEventListener("click", () => {
                    toggleUpdateSelection(update, entry.date, entry.link, card);
                });

                dateGroup.appendChild(card);
            });

            releaseNotesFeed.appendChild(dateGroup);
        });

        if (totalRendered === 0) {
            emptyState.style.display = "flex";
            releaseNotesFeed.style.display = "none";
        } else {
            emptyState.style.display = "none";
            releaseNotesFeed.style.display = "flex";
        }
    }

    function toggleUpdateSelection(update, dateStr, entryLink, cardElement) {
        if (selectedUpdates.has(update.id)) {
            selectedUpdates.delete(update.id);
            if (cardElement) cardElement.classList.remove("selected");
        } else {
            selectedUpdates.set(update.id, {
                id: update.id,
                type: update.type,
                date: dateStr,
                link: entryLink,
                text: update.plain_text
            });
            if (cardElement) cardElement.classList.add("selected");
        }
        
        // Re-render only the quick-tweet buttons inside this card instead of redrawing the entire list
        // which resets scroll and cursor positions. We can call renderNotes() if needed, but doing local edits is cleaner.
        // For security/cleanliness, let's just trigger a render of composer and sync card states.
        updateCardStates();
        generateTweetDraft();
    }

    function updateCardStates() {
        document.querySelectorAll(".update-card").forEach(card => {
            const id = card.dataset.id;
            const quickBtn = card.querySelector(".quick-tweet-btn");
            if (selectedUpdates.has(id)) {
                card.classList.add("selected");
                if (quickBtn) {
                    quickBtn.className = "quick-tweet-btn added";
                    quickBtn.innerHTML = '<i class="fa-solid fa-minus"></i> Deselect';
                }
            } else {
                card.classList.remove("selected");
                if (quickBtn) {
                    quickBtn.className = "quick-tweet-btn";
                    quickBtn.innerHTML = '<i class="fa-brands fa-x-twitter"></i> Select to Tweet';
                }
            }
        });
    }

    function generateTweetDraft() {
        if (selectedUpdates.size === 0) {
            tweetTextArea.value = "";
            updateComposerUI();
            return;
        }

        let draft = "";
        
        // Single update selected - make it specific and detailed
        if (selectedUpdates.size === 1) {
            const [update] = selectedUpdates.values();
            const tag = `[BigQuery ${update.type}]`;
            
            // Format: "[BigQuery Feature] (June 16): Text... Details: link"
            const dateShort = update.date.replace(/, \d{4}/, ''); // E.g. "June 16, 2026" -> "June 16"
            draft = `${tag} update for ${dateShort}:\n\n${update.text}\n\nRead more: ${update.link}`;
        } 
        // Multiple updates selected - aggregate them cleanly
        else {
            draft = "Google Cloud BigQuery release updates:\n\n";
            let index = 1;
            for (const update of selectedUpdates.values()) {
                const typeText = `[${update.type}]`;
                const summaryText = update.text.length > 80 
                    ? update.text.substring(0, 77) + "..." 
                    : update.text;
                
                draft += `${index}. ${typeText} ${summaryText}\n`;
                index++;
            }
            
            // Add reference link from the latest selected update or generic
            const updatesArray = Array.from(selectedUpdates.values());
            draft += `\nDocs: ${updatesArray[0].link}`;
        }

        // Limit check and crop if needed (or just let the user see it exceeds limit)
        tweetTextArea.value = draft;
        updateComposerUI();
    }

    function updateComposerUI() {
        const text = tweetTextArea.value;
        const length = text.length;
        
        selectedCountBadge.innerText = `${selectedUpdates.size} Selected`;
        charCountLabel.innerText = TWEET_LIMIT - length;
        
        // Show/hide textarea placeholder overlay
        if (length > 0) {
            textareaWrapper.classList.add("has-content");
            copyTweetBtn.disabled = false;
            clearComposerBtn.disabled = false;
            tweetBtn.disabled = length > TWEET_LIMIT;
        } else {
            textareaWrapper.classList.remove("has-content");
            copyTweetBtn.disabled = true;
            clearComposerBtn.disabled = true;
            tweetBtn.disabled = true;
        }

        // Color coding for length warning
        charCountLabel.className = "char-count-text";
        if (length > TWEET_LIMIT - 30 && length <= TWEET_LIMIT) {
            charCountLabel.classList.add("warning");
        } else if (length > TWEET_LIMIT) {
            charCountLabel.classList.add("danger");
        }

        // Update SVG Progress Ring
        if (charProgressRing) {
            let percentage = Math.min(length / TWEET_LIMIT, 1.0);
            if (length > TWEET_LIMIT) {
                // Keep it filled and change color to red
                charProgressRing.style.stroke = "var(--color-issue)";
                percentage = 1.0;
            } else if (length > TWEET_LIMIT - 30) {
                charProgressRing.style.stroke = "var(--color-deprecated)";
            } else {
                charProgressRing.style.stroke = "var(--color-primary)";
            }
            
            const offset = ringCircumference - (percentage * ringCircumference);
            charProgressRing.style.strokeDashoffset = offset;
        }
    }

    function clearComposer() {
        selectedUpdates.clear();
        tweetTextArea.value = "";
        updateCardStates();
        updateComposerUI();
        showToast("<i class='fa-regular fa-trash-can'></i> Composer cleared.");
    }

    function showToast(message) {
        toastMessage.innerHTML = message;
        toast.classList.add("show");
        
        // Auto hide
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function exportFeedToCSV() {
        if (!allReleaseNotes || allReleaseNotes.length === 0) {
            showToast("<i class='fa-solid fa-triangle-exclamation'></i> No data to export.");
            return;
        }

        const rows = [["Date", "Type", "Description", "Link"]];
        let exportCount = 0;

        allReleaseNotes.forEach(entry => {
            const filteredUpdates = entry.updates.filter(update => {
                if (currentFilter !== "all" && update.type.toLowerCase() !== currentFilter.toLowerCase()) return false;
                if (currentSearch) {
                    const textContent = (update.type + " " + update.plain_text).toLowerCase();
                    if (!textContent.includes(currentSearch)) return false;
                }
                return true;
            });

            filteredUpdates.forEach(update => {
                rows.push([
                    entry.date,
                    update.type,
                    update.plain_text,
                    entry.link
                ]);
                exportCount++;
            });
        });

        if (exportCount === 0) {
            showToast("<i class='fa-solid fa-triangle-exclamation'></i> No matching updates to export.");
            return;
        }

        // Convert rows to CSV format
        const csvContent = rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`<i class='fa-solid fa-file-csv'></i> Exported ${exportCount} updates to CSV!`);
    }
});
