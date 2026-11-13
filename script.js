/* DOM ELEMENTS */
const destinationInput = document.querySelector("#destination");
const plannerDestinationInput = document.querySelector("#placeInput");
const daysInput = document.querySelector("#days");
const budgetInput = document.querySelector("#budget");
const travellersInput = document.querySelector("#travellers");

const generateBtn = document.querySelector(".generate-btn");
const resultSection = document.querySelector(".result-section");
const emptyResult = document.querySelector(".empty-result");

let currentPlan = null;

/* Travel dates must be today or in the future. Date of birth and existing
   document records are intentionally excluded from this travel-date rule. */
(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const start = document.getElementById("startDate");
    const end = document.getElementById("endDate");
    const countdown = document.getElementById("countdownDate");
    [start, end, countdown].filter(Boolean).forEach(input => {
        input.min = today;
        if (input.value && input.value < today) input.value = "";
    });
    const syncEndDate = () => {
        if (!end) return;
        end.min = start?.value && start.value > today ? start.value : today;
        if (end.value && end.value < end.min) end.value = "";
    };
    start?.addEventListener("change", syncEndDate);
    syncEndDate();
})();

/* AI TRIP DATA STORAGE */
const tripData = {
    manali: {
        title: "Manali",
        description: "A perfect mountain escape filled with scenic views, adventure and peaceful nature.",
        places: ["Solang Valley", "Hadimba Temple", "Old Manali", "Mall Road", "Rohtang Pass"],
        food: ["Siddu", "Trout Fish", "Thukpa", "Momos"],
        hotel: "Comfortable mountain-view hotel",
        weather: "Sunny & Warm. Cotton clothes recommended.",
        checklist: ["Heavy Jackets & Thermals", "Woolen Socks & Gloves", "Moisturizer & Lip Balm", "Trekking Shoes", "Snow Goggles"],
        hospital: "Lady Willingdon Hospital, Manali"
    },
    goa: {
        title: "Goa",
        description: "Enjoy beaches, nightlife, Portuguese architecture and delicious coastal food.",
        places: ["Baga Beach", "Calangute Beach", "Fort Aguada", "Old Goa", "Anjuna"],
        food: ["Goan Fish Curry", "Prawn Curry", "Bebinca", "Chicken Xacuti"],
        hotel: "Beachside resort or budget hotel",
        weather: "Sunny & Warm. Cotton clothes recommended.",
        checklist: ["Cotton / Beach Wear", "High SPF Sunscreen", "Sunglasses & Sun Hat", "Flip Flops / Sandals", "Swimwear"],
        hospital: "Goa Medical College & Hospital, Bambolim"
    },
    kashmir: {
        title: "Kashmir",
        description: "Explore beautiful valleys, lakes, mountains and traditional Kashmiri culture.",
        places: ["Dal Lake", "Gulmarg", "Pahalgam", "Sonamarg", "Mughal Gardens"],
        food: ["Rogan Josh", "Wazwan", "Yakhni", "Kahwa"],
        hotel: "Comfortable hotel with valley views",
        weather: "Sunny & Warm. Cotton clothes recommended.",
        checklist: ["Warm Jackets & Sweaters", "Comfortable Walking Shoes", "Thermal Wear", "Camera & Extra Memory Card", "Umbrella"],
        hospital: "Government Medical College & Hospital, Srinagar"
    },
    jaipur: {
        title: "Jaipur",
        description: "Discover royal palaces, forts, colorful markets and authentic Rajasthani cuisine.",
        places: ["Amber Fort", "Hawa Mahal", "City Palace", "Jantar Mantar", "Nahargarh Fort"],
        food: ["Dal Baati Churma", "Ghewar", "Pyaaz Kachori", "Laal Maas"],
        hotel: "Heritage hotel or boutique stay",
        weather: "Sunny & Warm. Cotton clothes recommended.",
        checklist: ["Light Cotton Clothes", "Sunglasses & Cap", "Comfortable Walking Shoes", "Water Bottle", "Sunscreen Lotion"],
        hospital: "Sawai Man Singh Hospital, Jaipur"
    }
};

/* HELPER SCROLL FUNCTIONS */
function setDestination(destination) {
    if (destinationInput) destinationInput.value = destination;
    if (plannerDestinationInput) plannerDestinationInput.value = destination;
    window.exploreDestination?.(destination);
}

function scrollToPlanner() {
    const planner = document.querySelector(".planner");
    if (planner) planner.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToWeatherSection() {
    document.querySelector("#weatherSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToBestPlacesSection() {
    document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToHotelSection() {
    document.querySelector("#hotels")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToFoodSection() {
    document.querySelector("#food")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToTransportSection() {
    document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToMapSection() {
    document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToEmergencySection() {
    document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openLivePage(type) {
    const destination = plannerDestinationInput?.value.trim() || destinationInput?.value.trim() || window.prompt("Which destination would you like to explore?");
    if (!destination) return;
    window.location.assign(`live.html?type=${encodeURIComponent(type)}&destination=${encodeURIComponent(destination)}`);
}

function openDestinationDetail(destination) {
    window.location.assign(`destination.html?place=${encodeURIComponent(destination)}`);
}

/* GENERATE TRIP PLAN (UPDATED WITH CHECKLIST PROGRESS & INTERACTIVE TIMELINE) */
function generateTripPlan() {
    let destination = plannerDestinationInput?.value.trim() || destinationInput?.value.trim();

    const days = daysInput ? parseInt(daysInput.value) || 5 : 5;
    const travellers = travellersInput ? parseInt(travellersInput.value) || 8 : 8;
    let inputBudget = budgetInput ? parseInt(budgetInput.value) || 100000 : 100000;

    if (!destination) {
        alert("Please enter your destination.");
        if (plannerDestinationInput) plannerDestinationInput.focus();
        return;
    }

    const key = destination.toLowerCase();
    let data = tripData[key] || {
        title: destination,
        description: `Explore ${destination} with a personalized ${days}-day travel plan.`,
        places: ["Main tourist attractions", "Local markets", "Popular sightseeing spots", "Cultural landmarks"],
        food: ["Local specialities", "Popular street food", "Traditional cuisine"],
        hotel: "Comfortable hotel matching your budget",
        weather: "Sunny & Warm. Cotton clothes recommended.",
        checklist: ["Comfortable Clothes", "Essential Medicines", "Universal Charger & Power Bank", "Government ID Proofs", "Footwear"],
        hospital: `Nearest major emergency center in ${destination}`
    };

    const hotelCostPerDay = 1800 * travellers;
    const foodCostPerDay = 800 * travellers;
    const transportCostPerDay = 600 * travellers;

    const totalHotel = hotelCostPerDay * days;
    const totalFood = foodCostPerDay * days;
    const totalTransport = transportCostPerDay * days;
    const estimatedTotal = totalHotel + totalFood + totalTransport;

    if (!inputBudget) inputBudget = estimatedTotal;

    currentPlan = {
        title: data.title,
        days: days,
        travellers: travellers,
        budget: inputBudget,
        estimatedTotal: estimatedTotal,
        places: data.places,
        weather: data.weather
    };

    // Dynamic Timeline Generator
    let timelineHTML = `<div class="timeline-container"><h4>📅 Day-by-Day Interactive Schedule</h4>`;
    for(let i = 1; i <= Math.min(days, 5); i++) {
        timelineHTML += `
            <div class="timeline-day">
                <strong>Day ${i}:</strong> ${data.places[(i - 1) % data.places.length]} & Morning Sightseeing
                <div class="time-slots">
                    <span>🕘 09:00 AM - Breakfast</span>
                    <span>📍 11:00 AM - Visit ${data.places[(i - 1) % data.places.length]}</span>
                    <span>🍛 02:00 PM - Try ${data.food[(i - 1) % data.food.length]}</span>
                </div>
            </div>
        `;
    }
    timelineHTML += `</div>`;

    // Dynamic Checklist with Progress Bar
    let checklistHTML = `
        <div class="packing-progress-box">
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="packingProgressBar" style="width: 0%;"></div></div>
            <span id="packingProgressText" style="font-size: 12px; font-weight:700;">0% Packed</span>
        </div>
        <ul class="interactive-checklist">
            ${data.checklist.map((item, idx) => `
                <li>
                    <input type="checkbox" id="chk_${idx}" onchange="updatePackingProgress(${data.checklist.length})">
                    <label for="chk_${idx}">${escapeHTML(item)}</label>
                </li>
            `).join("")}
        </ul>
    `;

    const resultHTML = `
        <div class="ai-result">
            <div class="ai-result-header">
                <h2>✨ Your Personalized Trip Plan for ${escapeHTML(data.title)}</h2>
                <p>${escapeHTML(data.description)}</p>
                
                <div class="info-action-box">
                    <div class="trip-badges-container">
                        <span class="trip-badge">📅 ${days} Days</span>
                        <span class="trip-badge">👨‍👩‍👧 ${travellers} Traveller(s)</span>
                        <span class="trip-badge">💰 Target Budget: ₹${escapeHTML(inputBudget.toLocaleString())}</span>
                    </div>
                    
                    <div class="result-action-btns">
                        <button class="action-btn save" onclick="saveItinerary()">🔖 Save Plan</button>
                        <button class="action-btn print" onclick="window.print()">📥 Download Summary / Print</button>
                        <a href="live.html?type=map&destination=${encodeURIComponent(data.title)}" class="action-btn map">🗺️ Open map here</a>
                    </div>
                </div>
            </div>
            
            <div class="result-grid">
                <div class="result-box highlight">
                    <h3>📊 Estimated Cost Breakdown</h3>
                    <p style="margin-bottom:8px;"><strong>🏨 Hotel:</strong> ₹${totalHotel.toLocaleString()}</p>
                    <p style="margin-bottom:8px;"><strong>🍔 Food:</strong> ₹${totalFood.toLocaleString()}</p>
                    <p style="margin-bottom:8px;"><strong>🚗 Transport:</strong> ₹${totalTransport.toLocaleString()}</p>
                    <hr style="margin:10px 0; border:0; border-top:1px solid #e7eeee;">
                    <p style="color:#08a88a; font-weight:700; font-size:14px;">Total Est. Cost: ₹${estimatedTotal.toLocaleString()}</p>
                </div>

                <div class="result-box">
                    <h3>🎒 Smart Packing Checklist</h3>
                    ${checklistHTML}
                </div>

                <div class="result-box">
                    <h3>📍 Places to Visit</h3>
                    <p>${data.places.map(p => escapeHTML(p)).join(" • ")}</p>
                </div>

                <div class="result-box">
                    <h3>🏨 Recommended Stay</h3>
                    <p>${escapeHTML(data.hotel)}</p>
                </div>

                <div class="result-box">
                    <h3>🍴 Must Try Food</h3>
                    <p>${data.food.map(f => escapeHTML(f)).join(" • ")}</p>
                </div>

                <div class="result-box">
                    <h3>🌤️ Weather Tip</h3>
                    <p>${escapeHTML(data.weather)}</p>
                </div>
            </div>

            <div style="padding: 0 25px 25px 25px; background: #f8fbfc; border-radius: 0 0 20px 20px;">
                ${timelineHTML}
            </div>
        </div>
    `;

    if (emptyResult) emptyResult.style.display = "none";
    if (resultSection) {
        resultSection.innerHTML = resultHTML;
        resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function generateAIPlan() { generateTripPlan(); }

/* PACKING PROGRESS BAR FUNCTION */
function updatePackingProgress(totalItems) {
    const checked = document.querySelectorAll(".interactive-checklist input[type='checkbox']:checked").length;
    const percentage = Math.round((checked / totalItems) * 100);
    const bar = document.getElementById("packingProgressBar");
    const text = document.getElementById("packingProgressText");
    if(bar) bar.style.width = percentage + "%";
    if(text) text.textContent = `${percentage}% Packed (${checked}/${totalItems})`;
}

/* EXPENSE TRACKER FUNCTIONS */
function addExpense() {
    const title = document.getElementById("expenseTitle").value.trim();
    const amount = parseFloat(document.getElementById("expenseAmount").value);
    const category = document.getElementById("expenseCategory").value;

    if(!title || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid expense title and amount.");
        return;
    }

    let expenses = JSON.parse(localStorage.getItem("arsExpenses") || "[]");
    expenses.push({ id: Date.now(), title, amount, category });
    localStorage.setItem("arsExpenses", JSON.stringify(expenses));

    document.getElementById("expenseTitle").value = "";
    document.getElementById("expenseAmount").value = "";
    renderExpenses();
}

function deleteExpense(id) {
    let expenses = JSON.parse(localStorage.getItem("arsExpenses") || "[]");
    expenses = expenses.filter(e => e.id !== id);
    localStorage.setItem("arsExpenses", JSON.stringify(expenses));
    renderExpenses();
}

function renderExpenses() {
    const list = document.getElementById("expenseList");
    const totalSpentText = document.getElementById("totalSpentText");
    const totalItemsText = document.getElementById("totalItemsText");
    if (!list) return;

    let expenses = JSON.parse(localStorage.getItem("arsExpenses") || "[]");
    let total = expenses.reduce((sum, item) => sum + item.amount, 0);

    totalSpentText.textContent = `₹${total.toLocaleString()}`;
    totalItemsText.textContent = expenses.length;
    const chart = document.getElementById("expenseChart");
    if (chart) {
        const byCategory = expenses.reduce((groups, item) => ({ ...groups, [item.category]: (groups[item.category] || 0) + item.amount }), {});
        chart.innerHTML = total ? Object.entries(byCategory).map(([category, amount]) => `<div class="expense-bar-row"><span>${escapeHTML(category)}</span><div class="expense-bar-track"><div class="expense-bar-fill" style="width:${Math.round(amount / total * 100)}%"></div></div><strong>₹${amount.toLocaleString()}</strong></div>`).join("") : "";
    }

    if (expenses.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#78818c; padding:15px;">No expenses logged yet.</p>`;
        return;
    }

    let html = "";
    expenses.forEach(item => {
        html += `
            <div class="expense-item">
                <div>
                    <strong>${escapeHTML(item.title)}</strong>
                    <small style="display:block; color:#7a828e;">${item.category}</small>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:700; color:#08a88a;">₹${item.amount.toLocaleString()}</span>
                    <button onclick="deleteExpense(${item.id})" class="delete-exp-btn">✕</button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

/* PHOTO GALLERY & TRIP MEMORIES FUNCTIONS */
function uploadPhoto(event) {
    const file = event.target.files[0];
    const caption = document.getElementById("photoCaption").value.trim() || "Trip Memory";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const photoData = e.target.result;
        let photos = JSON.parse(localStorage.getItem("arsPhotos") || "[]");
        photos.push({ id: Date.now(), image: photoData, caption: caption });
        localStorage.setItem("arsPhotos", JSON.stringify(photos));
        document.getElementById("photoCaption").value = "";
        renderMemories();
    };
    reader.readAsDataURL(file);
}

function deletePhoto(id) {
    let photos = JSON.parse(localStorage.getItem("arsPhotos") || "[]");
    photos = photos.filter(p => p.id !== id);
    localStorage.setItem("arsPhotos", JSON.stringify(photos));
    renderMemories();
}

function renderMemories() {
    const grid = document.getElementById("galleryGrid");
    if (!grid) return;

    let photos = JSON.parse(localStorage.getItem("arsPhotos") || "[]");
    if (photos.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#7a828e; padding:20px;">No photos uploaded yet. Upload your first trip memory!</p>`;
        return;
    }

    let html = "";
    photos.forEach(p => {
        html += `
            <div class="gallery-card">
                <img src="${p.image}" alt="Memory">
                <div class="gallery-card-info">
                    <p>${escapeHTML(p.caption)}</p>
                    <button onclick="deletePhoto(${p.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

/* FEEDBACK */
function toggleFeedback() {
    const feedbackWindow = document.querySelector(".feedback-window");
    if (feedbackWindow) feedbackWindow.style.display = feedbackWindow.style.display === "block" ? "none" : "block";
}

function setRating(rating) {
    const ratingInput = document.querySelector("#feedbackRating");
    if (ratingInput) ratingInput.value = rating;
    const buttons = document.querySelectorAll(".rating-buttons button");
    buttons.forEach((btn, index) => {
        if (index < rating) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

function submitFeedback() {
    const nameInput = document.querySelector("#feedbackName");
    const textInput = document.querySelector("#feedbackText");
    const ratingInput = document.querySelector("#feedbackRating");
    const msg = document.querySelector("#feedbackMessage");

    if (msg) msg.textContent = "Thank you for your feedback! 💚";
    setTimeout(() => {
        toggleFeedback();
        if (nameInput) nameInput.value = "";
        if (textInput) textInput.value = "";
        if (ratingInput) ratingInput.value = "0";
        setRating(0);
        if (msg) msg.textContent = "";
    }, 1500);
}

/* AUTHENTICATION */
function openAuth() {
    const overlay = document.querySelector("#authOverlay");
    if (overlay) overlay.style.display = "flex";
}

function closeAuth() {
    const overlay = document.querySelector("#authOverlay");
    if (overlay) overlay.style.display = "none";
}

function handleAuthButton() {
    window.handleAuthButton?.();
}

function updateAuthButton() {
    window.updateAuthButton?.();
}

function showLogin() {
    document.querySelector("#loginForm").style.display = "block";
    document.querySelector("#signupForm").style.display = "none";
    document.querySelector("#forgotPasswordForm").style.display = "none";
    document.querySelector("#loginTab").classList.add("active");
    document.querySelector("#signupTab").classList.remove("active");
}

function showSignup() {
    document.querySelector("#loginForm").style.display = "none";
    document.querySelector("#signupForm").style.display = "block";
    document.querySelector("#forgotPasswordForm").style.display = "none";
    document.querySelector("#signupTab").classList.add("active");
    document.querySelector("#loginTab").classList.remove("active");
}

function showForgotPassword() {
    document.querySelector("#loginForm").style.display = "none";
    document.querySelector("#signupForm").style.display = "none";
    document.querySelector("#forgotPasswordForm").style.display = "block";
}

function togglePassword(id, btn) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
    }
}

function resetPassword(e) {
    e.preventDefault();
    const msg = document.querySelector("#forgotMessage");
    const email = document.querySelector("#forgotEmail")?.value;
    fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
        .then(response => response.json()).then(data => { if (msg) msg.textContent = data.message || data.error || "Please try again."; })
        .catch(() => { if (msg) msg.textContent = "Could not contact the server. Please try again."; });
}

function shareWebsite() {
    if (navigator.share) {
        navigator.share({ title: "ARS Tourist Guide", url: window.location.href });
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert("Website URL copied to clipboard!");
    }
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

/* DARK MODE TOGGLE */
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("arsDarkMode", isDark);
    const btn = document.getElementById("darkModeBtn");
    if(btn) btn.textContent = isDark ? "☀️" : "🌙";
}

/* SAVED PLANS DASHBOARD */
function openSavedPlans() {
    const overlay = document.getElementById("savedPlansOverlay");
    if (overlay) overlay.style.display = "flex";
    window.renderSavedPlans?.();
}

function closeSavedPlans() {
    const overlay = document.getElementById("savedPlansOverlay");
    if (overlay) overlay.style.display = "none";
}

/* PWA OFFLINE SERVICE WORKER REGISTRATION */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration skipped', err));
    });
}

/* INITIALIZATION ON PAGE LOAD */
document.addEventListener("DOMContentLoaded", () => {
    updateAuthButton();
    renderExpenses();
    renderMemories();
    initTripTools();
    
    if(localStorage.getItem("arsDarkMode") === "true") {
        document.body.classList.add("dark-mode");
        const btn = document.getElementById("darkModeBtn");
        if(btn) btn.textContent = "☀️";
    }
});

function initTripTools() {
    const date = document.getElementById("countdownDate"); const message = document.getElementById("countdownMessage");
    if (date && message) {
        date.value = localStorage.getItem("arsCountdownDate") || document.getElementById("startDate")?.value || "";
        if (date.min && date.value && date.value < date.min) { date.value = ""; localStorage.removeItem("arsCountdownDate"); }
        const updateCountdown = () => { localStorage.setItem("arsCountdownDate", date.value); if (!date.value) { message.textContent = "Choose your departure date to start the countdown."; return; } const days = Math.ceil((new Date(`${date.value}T00:00:00`) - new Date()) / 86400000); message.textContent = days < 0 ? "This trip date has passed — choose a new adventure!" : days === 0 ? "Your trip starts today! Have a wonderful journey." : `${days} day${days === 1 ? "" : "s"} to go — start packing!`; };
        date.addEventListener("change", updateCountdown); updateCountdown();
    }
    const docs = JSON.parse(localStorage.getItem("arsTravelDocuments") || "{}");
    document.querySelectorAll("[data-trip-doc]").forEach(box => { box.checked = Boolean(docs[box.dataset.tripDoc]); box.addEventListener("change", () => { docs[box.dataset.tripDoc] = box.checked; localStorage.setItem("arsTravelDocuments", JSON.stringify(docs)); }); });
    const wishlist = JSON.parse(localStorage.getItem("arsWishlist") || "[]"); const summary = document.getElementById("wishlistSummary"); if (summary) summary.textContent = wishlist.length ? `${wishlist.length} saved item${wishlist.length === 1 ? "" : "s"} ready for your trip.` : "No saved places yet.";
}

/* SERVER INTEGRATION: authentication, live data, AI and database-backed feedback */
(() => {
    const api = async (url, options = {}) => {
        const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
        if (location.protocol === "file:") throw new Error("Start the server and open the website at http://localhost:3010. Do not open index.HTML directly.");
        if (!navigator.onLine) throw new Error("You are offline. Check your internet connection and try again.");
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
        let response;
        try { response = await fetch(url, { ...options, headers, credentials: "same-origin", signal: controller.signal }); }
        catch (error) {
            if (error.name === "AbortError") throw new Error("The request timed out. Check your internet connection or server and try again.");
            throw new Error("Could not connect to the server. Run `npm.cmd start`, then open http://localhost:3010.");
        } finally { clearTimeout(timer); }
        const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Request failed. Please try again.");
        return payload;
    };
    const openVerifiedLivePage = async (type, selectedDestination) => {
        const destination = (selectedDestination || document.getElementById("destination")?.value || "").trim();
        if (!destination) { document.getElementById("destination")?.focus(); return; }
        // Do not block the visitor behind a geocoding request. The live page can
        // validate the destination itself and show the most useful error there.
        // This also makes the Explore button work for Kashmir and other regions.
        window.location.assign(`live.html?type=${encodeURIComponent(type)}&destination=${encodeURIComponent(destination)}`);
    };
    window.exploreDestination = selectedDestination => openVerifiedLivePage("places", selectedDestination);
    window.openHotelFinder = async () => {
        const destination = (document.getElementById("placeInput")?.value || document.getElementById("destination")?.value || "").trim();
        if (!destination) { document.getElementById("destination")?.focus(); return; }
        window.location.assign(`hotel.html?destination=${encodeURIComponent(destination)}`);
    };
    window.openTransportFinder = () => {
        const destination = getDestination(); const origin = document.getElementById("startCity")?.value.trim() || "";
        if (!destination) return document.getElementById("destination")?.focus();
        window.location.assign(`live.html?type=transport&destination=${encodeURIComponent(destination)}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`);
    };
    document.getElementById("destination")?.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); window.runSiteSearch?.(); }
    });
    const esc = value => String(value || "").replace(/[&<>\"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" })[char]);
    const getDestination = () => (document.getElementById("placeInput")?.value || document.getElementById("destination")?.value || "").trim();
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    const currentUser = () => { try { return JSON.parse(localStorage.getItem("arsUser") || "null"); } catch { return null; } };
    const isLoggedIn = () => Boolean(currentUser());
    window.recordActivity = (action, detail = "") => {
        if (!isLoggedIn()) return Promise.resolve();
        return api("/api/account/history", { method: "POST", keepalive: true, body: JSON.stringify({ action, detail }) }).catch(() => null);
    };

    function updateServerAuthButton() {
        const button = document.getElementById("authButton");
        const user = currentUser();
        if (button) button.textContent = user ? `🚪 Logout (${user.name})` : "👤 Login / Sign Up";
    }
    window.updateAuthButton = updateServerAuthButton;
    window.handleAuthButton = () => {
        if (isLoggedIn()) { api("/api/auth/logout", { method: "POST" }).catch(() => {}).finally(() => { localStorage.removeItem("arsAuthToken"); localStorage.removeItem("arsUser"); updateServerAuthButton(); }); }
        else window.openAuth();
    };
    window.loginUser = async event => {
        event.preventDefault(); const message = document.getElementById("loginMessage");
        try {
            const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: document.getElementById("loginEmail").value, password: document.getElementById("loginPassword").value }) });
            localStorage.removeItem("arsAuthToken"); localStorage.setItem("arsUser", JSON.stringify(result.user)); updateServerAuthButton(); window.recordActivity("Signed in", "Account login"); window.closeAuth();
        } catch (error) { if (message) message.textContent = error.message; }
    };
    window.signupUser = async event => {
        event.preventDefault(); const message = document.getElementById("signupMessage");
        const password = document.getElementById("signupPassword").value;
        if (password !== document.getElementById("signupConfirmPassword").value) { if (message) message.textContent = "Passwords do not match."; return; }
        try {
            const result = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ name: document.getElementById("signupName").value, email: document.getElementById("signupEmail").value, password }) });
            localStorage.removeItem("arsAuthToken"); localStorage.setItem("arsUser", JSON.stringify(result.user)); updateServerAuthButton(); window.recordActivity("Created account", "Account signup"); window.closeAuth();
        } catch (error) { if (message) message.textContent = error.message; }
    };
    // Provider buttons are disabled until their server-side OAuth/SMS credentials are configured.
    // Keep this fallback non-blocking in case an older page still calls it.
    window.showProviderNotice = provider => {
        const message = document.getElementById("signupMessage");
        if (message) message.textContent = `${provider} sign-in is coming soon. Please create an account with email and password.`;
    };
    let activeVoiceRecognition = null;
    window.startVoiceSearch = async () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const button = document.getElementById("voiceSearchButton");
        const result = document.getElementById("siteSearchHelp");
        const destination = document.getElementById("destination");
        if (!SpeechRecognition) {
            if (result) result.textContent = "Voice search works in Chrome or Edge. Please type your destination in this browser.";
            return destination?.focus();
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            if (result) result.textContent = "Microphone access is unavailable here. Open the site at http://localhost:3010 in Chrome or Edge.";
            return destination?.focus();
        }
        if (activeVoiceRecognition) { activeVoiceRecognition.stop(); return; }
        if (button) { button.disabled = true; button.classList.add("is-listening"); button.innerHTML = "● <span>Listening</span>"; }
        if (result) result.textContent = "Allow microphone access, then say a destination such as Goa or Paris.";
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            const recognition = new SpeechRecognition(); activeVoiceRecognition = recognition;
            recognition.lang = navigator.language?.startsWith("hi") ? "hi-IN" : "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;
            recognition.onstart = () => { if (result) result.textContent = "Listening… say a destination, for example Goa or Paris."; };
            recognition.onresult = event => { const phrase = event.results[0][0].transcript.trim(); if (destination) destination.value = phrase.replace(/.*?(?:ka|ki|to|for)\s+/i, "").replace(/\s+(?:sasta|package|dikhao|dikhaiye).*$/i, "").trim() || phrase; if (result) result.textContent = `Heard “${phrase}”. Press Explore to continue.`; destination?.focus(); };
            recognition.onerror = event => { const messages = { "not-allowed": "Microphone permission is blocked. Click the lock icon beside the address bar, allow Microphone, then try again.", "no-speech": "No speech was heard. Please try again and speak clearly.", network: "Voice recognition needs an internet connection. Check your connection and try again." }; if (result) result.textContent = messages[event.error] || "Voice search could not start. Please try again or type your destination."; };
            recognition.onend = () => { activeVoiceRecognition = null; if (button) { button.disabled = false; button.classList.remove("is-listening"); button.innerHTML = "🎙️ <span>Voice</span>"; } };
            recognition.start();
        } catch (error) {
            if (result) result.textContent = "Microphone permission is needed for Voice search. Allow it in your browser and try again.";
            if (button) { button.disabled = false; button.classList.remove("is-listening"); button.innerHTML = "🎙️ <span>Voice</span>"; }
        }
    };
    window.updateBudgetLabel = value => { const label = document.getElementById("budgetLabel"); if (label) label.textContent = `₹${Number(value).toLocaleString("en-IN")}`; };
    window.applyDiscoveryFilters = () => {
        const destination = document.getElementById("destination")?.value.trim(); const continent = document.getElementById("continentFilter")?.value; const visa = document.getElementById("visaFilter")?.value;
        const type = document.getElementById("travellerTypeFilter")?.value; const days = document.getElementById("durationFilter")?.value; const budget = document.getElementById("discoveryBudget")?.value;
        const needs = [...document.querySelectorAll(".needFilter:checked")].map(item => item.value); const result = document.getElementById("discoveryResult");
        const plannerDestination = document.getElementById("placeInput"); if (destination && plannerDestination) plannerDestination.value = destination;
        const plannerDays = document.getElementById("days"); if (plannerDays) plannerDays.value = days;
        const plannerBudget = document.getElementById("budget"); if (plannerBudget) plannerBudget.value = budget;
        if (result) result.innerHTML = `<span class="discovery-copy">${esc(destination || "Your destination")}: ${days}-day ${esc(type || "flexible")} trip, up to ₹${Number(budget).toLocaleString("en-IN")} per person${continent ? ` · ${esc(continent)}` : ""}${visa ? ` · ${esc(visa)}` : ""}${needs.length ? ` · needs: ${needs.map(esc).join(", ")}` : ""}. Your planner has been updated.</span><button type="button" class="discovery-plan-link" onclick="scrollToPlanner()">View updated planner →</button>`;
    };
    const searchTargets = [
        { icon: "🗓️", title: "Trip planner", description: "Create a complete itinerary", words: ["plan", "planner", "itinerary", "trip"], scroll: "#planner" },
        { icon: "🌍", title: "International discovery", description: "Find destinations and visa ideas", words: ["discover", "international", "visa", "country", "destination"], scroll: "#explore" },
        { icon: "🏨", title: "Hotels & stays", description: "Find a hotel for your destination", words: ["hotel", "stay", "room", "resort", "accommodation"], url: "hotel.html" },
        { icon: "🎒", title: "Tour packages", description: "Browse travel packages", words: ["package", "tour", "holiday"], url: "packages.html" },
        { icon: "🌦️", title: "Live weather", description: "Check current travel weather", words: ["weather", "mausam", "rain", "temperature"], url: "live.html?type=weather" },
        { icon: "✈️", title: "Flights, trains & buses", description: "Explore transport options", words: ["flight", "train", "bus", "transport", "travel route"], url: "live.html?type=transport" },
        { icon: "💸", title: "Budget expense tracker", description: "Track trip expenses and memories", words: ["tool", "tracker", "budget", "expense", "money", "gallery", "photo"], url: "tracker.html" },
        { icon: "♥", title: "Wishlist", description: "Open your saved travel picks", words: ["wishlist", "saved", "favourite", "favorite"], url: "wishlist.html" },
        { icon: "💱", title: "Currency converter", description: "Convert money to Indian Rupees", words: ["currency", "convert", "exchange", "rupee"], scroll: "#tripTools" },
        { icon: "🌿", title: "Carbon footprint", description: "Compare travel emissions", words: ["carbon", "eco", "emission", "co2"], scroll: "#tripTools" },
        { icon: "🆘", title: "Emergency SOS", description: "Save contacts and share your location", words: ["sos", "emergency", "safety", "help", "police"], url: "sos.html" },
        { icon: "⭐", title: "Travel reviews", description: "Read and write trip reviews", words: ["review", "rating", "feedback", "photo review"], url: "reviews.html" },
        { icon: "📷", title: "Camera landmark guide", description: "Open the AR travel guide", words: ["camera", "ar", "landmark"], url: "ar.html" },
        { icon: "💬", title: "Travel assistant", description: "Ask for packing and trip advice", words: ["assistant", "chat", "packing", "pack"], action: "chat" },
        { icon: "👤", title: "Login & travel profile", description: "Manage your account and travellers", words: ["login", "sign in", "account", "profile", "traveller"], action: "account" },
        { icon: "♡", title: "Saved trip plans", description: "Open saved itineraries", words: ["saved plan", "my plans", "saved itinerary"], action: "plans" }
    ];
    const getSearchMatches = query => {
        const text = query.toLowerCase().trim();
        if (!text) return searchTargets.slice(0, 8);
        const terms = text.split(/\s+/).filter(Boolean);
        return searchTargets.filter(target => [target.title, target.description, ...target.words].join(" ").toLowerCase().includes(text) || terms.some(term => target.words.some(word => word.includes(term))));
    };
    const openSearchTarget = target => {
        if (!target) return;
        window.recordActivity?.("Used site search", target.title);
        if (target.url) location.assign(target.url);
        else if (target.scroll) document.querySelector(target.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (target.action === "chat") window.toggleChat?.();
        else if (target.action === "account") window.handleAuthButton?.();
        else if (target.action === "plans") window.openSavedPlans?.();
    };
    const renderSiteSearchResults = query => {
        const results = document.getElementById("siteSearchResults");
        if (!results) return;
        const matches = getSearchMatches(query);
        results.innerHTML = "";
        matches.slice(0, 8).forEach(target => {
            const button = document.createElement("button"); button.type = "button"; button.className = "site-search-result"; button.setAttribute("role", "option");
            button.innerHTML = `<span class="site-search-result-icon">${target.icon}</span><span><b>${esc(target.title)}</b><small>${esc(target.description)}</small></span><span class="site-search-result-arrow">→</span>`;
            button.addEventListener("click", () => { results.hidden = true; openSearchTarget(target); }); results.appendChild(button);
        });
        if (query.trim() && !matches.length) {
            const destination = document.createElement("button"); destination.type = "button"; destination.className = "site-search-result";
            destination.innerHTML = `<span class="site-search-result-icon">📍</span><span><b>Explore “${esc(query.trim())}”</b><small>Open its destination guide</small></span><span class="site-search-result-arrow">→</span>`;
            destination.addEventListener("click", () => { results.hidden = true; window.exploreDestination(query.trim()); }); results.appendChild(destination);
        }
        results.hidden = !results.children.length;
    };
    window.runSiteSearch = () => {
        const input = document.getElementById("destination"); const query = input?.value.trim() || "";
        const help = document.getElementById("siteSearchHelp");
        if (!query) { if (help) help.textContent = "Type what you want to find, for example hotels, packages, weather, or Kashmir."; input?.focus(); return; }
        window.recordActivity?.("Searched website", query);
        const target = getSearchMatches(query)[0];
        document.getElementById("siteSearchResults")?.setAttribute("hidden", "");
        if (target) { openSearchTarget(target); return; }
        window.exploreDestination(query);
    };
    const siteSearchInput = document.getElementById("destination");
    siteSearchInput?.addEventListener("input", () => renderSiteSearchResults(siteSearchInput.value));
    siteSearchInput?.addEventListener("focus", () => renderSiteSearchResults(siteSearchInput.value));
    document.addEventListener("click", event => { if (!event.target.closest(".search-box") && !event.target.closest("#siteSearchResults")) { const results = document.getElementById("siteSearchResults"); if (results) results.hidden = true; } });
    const renderTravellers = async () => {
        const list = document.getElementById("travellerList"); const select = document.getElementById("documentTraveller"); if (!list || !select) return;
        const people = await api("/api/account/travellers"); select.innerHTML = `<option value="">Account holder</option>${people.map(p => `<option value="${p.id}">${esc(p.full_name)}</option>`).join("")}`;
        list.innerHTML = people.length ? people.map(p => `<article class="profile-item"><div><strong>${esc(p.full_name)} <small>· ${esc(p.traveller_type)}</small></strong><p>${[p.relationship, p.nationality, p.passport_number ? `Passport: ${p.passport_number}` : ""].filter(Boolean).join(" · ") || "Details can be added later"}</p></div><button onclick="deleteTraveller(${p.id})">Remove</button></article>`).join("") : "<p>No traveller saved yet. Add your first traveller above.</p>";
    };
    const renderDocuments = async () => { const list = document.getElementById("documentList"); if (!list) return; const docs = await api("/api/account/documents"); list.innerHTML = docs.length ? docs.map(d => `<article class="profile-item"><div><strong>${esc(d.document_type)}${d.traveller_name ? ` · ${esc(d.traveller_name)}` : ""}</strong><p>${esc(d.document_number || "No number")} ${d.expiry_date ? `· Expires ${esc(d.expiry_date)}` : ""} · ${esc(d.status)}</p></div><button onclick="deleteDocument(${d.id})">Remove</button></article>`).join("") : "<p>Your document wallet is empty.</p>"; };
    const renderHistory = async () => { const list = document.getElementById("historyList"); if (!list) return; const items = await api("/api/account/history"); list.innerHTML = items.length ? items.map(item => `<article class="profile-item"><div><strong>${esc(item.action)}</strong><p>${esc(item.detail || "")}${item.detail ? " · " : ""}${new Date(`${item.created_at}Z`).toLocaleString()}</p></div></article>`).join("") : "<p>No account activity yet.</p>"; };
    window.openProfile = async () => { if (!isLoggedIn()) return window.openAuth(); document.getElementById("profileOverlay").style.display = "flex"; try { await Promise.all([renderTravellers(), renderDocuments(), renderHistory()]); } catch (error) { alert(error.message); } };
    window.closeProfile = () => { document.getElementById("profileOverlay").style.display = "none"; };
    window.showProfileTab = tab => { document.getElementById("travellersPanel").hidden = tab !== "travellers"; document.getElementById("documentsPanel").hidden = tab !== "documents"; document.getElementById("historyPanel").hidden = tab !== "history"; if (tab === "history") renderHistory().catch(() => {}); document.querySelectorAll("[data-profile-tab]").forEach(button => button.classList.toggle("active", button.dataset.profileTab === tab)); };
    window.saveTraveller = async event => { event.preventDefault(); try { await api("/api/account/travellers", { method: "POST", body: JSON.stringify({ fullName: document.getElementById("travellerName").value, travellerType: document.getElementById("travellerType").value, dateOfBirth: document.getElementById("travellerDob").value, passportNumber: document.getElementById("travellerPassport").value, nationality: document.getElementById("travellerNationality").value, relationship: document.getElementById("travellerRelationship").value }) }); event.target.reset(); await renderTravellers(); } catch (error) { alert(error.message); } };
    window.deleteTraveller = async id => { try { await api(`/api/account/travellers/${id}`, { method: "DELETE" }); await Promise.all([renderTravellers(), renderDocuments()]); } catch (error) { alert(error.message); } };
    window.saveDocument = async event => { event.preventDefault(); try { await api("/api/account/documents", { method: "POST", body: JSON.stringify({ travellerId: document.getElementById("documentTraveller").value, documentType: document.getElementById("documentType").value, documentNumber: document.getElementById("documentNumber").value, expiryDate: document.getElementById("documentExpiry").value }) }); event.target.reset(); await renderDocuments(); } catch (error) { alert(error.message); } };
    window.deleteDocument = async id => { try { await api(`/api/account/documents/${id}`, { method: "DELETE" }); await renderDocuments(); } catch (error) { alert(error.message); } };
    window.submitFeedback = async () => {
        const message = document.getElementById("feedbackMessage");
        try {
            const photo = document.getElementById("feedbackPhoto")?.files?.[0];
            if (photo && (!["image/png", "image/jpeg", "image/webp"].includes(photo.type) || photo.size > 2 * 1024 * 1024)) throw new Error("Upload a PNG, JPEG, or WebP photo smaller than 2 MB.");
            const photoData = photo ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The photo could not be read. Please choose it again.")); reader.readAsDataURL(photo); }) : "";
            const result = await api("/api/feedback", { method: "POST", body: JSON.stringify({ name: document.getElementById("feedbackName").value, rating: Number(document.getElementById("feedbackRating").value), message: document.getElementById("feedbackText").value, photoData }) });
            if (message) message.textContent = result.message;
            document.getElementById("feedbackName").value = ""; document.getElementById("feedbackText").value = ""; document.getElementById("feedbackPhoto").value = ""; window.setRating(0);
            await renderFeedback();
        } catch (error) { if (message) message.textContent = error.message; }
    };
    const renderFeedback = async () => {
        const list = document.getElementById("feedbackList"); if (!list) return;
        try {
            const feedback = await api("/api/feedback");
            list.innerHTML = feedback.length ? `<h4>Recent traveller feedback</h4>${feedback.map(item => `<article><strong>${esc(item.name)}</strong><span aria-label="${item.rating} out of 5 stars">${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}</span><p>${esc(item.message)}</p>${item.photo_data ? `<img class="feedback-photo" src="${item.photo_data}" alt="Photo shared by ${esc(item.name)}">` : ""}</article>`).join("")}` : "";
        } catch { list.innerHTML = ""; }
    };
    function renderWeather(data) {
        setText("weatherIcon", data.icon); setText("weatherTemperature", `${data.temperature}°C`); setText("weatherCondition", `${data.condition} · ${data.location}`);
        setText("weatherHumidity", `${data.humidity}%`); setText("weatherWind", `${data.wind} km/h`); setText("weatherRain", `${data.rain} mm`);
        setText("weatherSunrise", data.sunrise ? new Date(data.sunrise).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
        setText("weatherTip", `💡 Live update for ${data.location}: ${data.condition}. Check the forecast again before outdoor activities.`);
    }
    function internalMapButton(item, label) { return `<button class="action-btn map" type="button" data-inline-map-name="${esc(item.name)}" data-inline-map-lat="${esc(item.lat)}" data-inline-map-lon="${esc(item.lon)}">${label}</button>`; }
    function showSiteMapEmbed(canvas, name, latitude, longitude) {
        const delta = 0.012;
        const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].map(value => value.toFixed(6)).join("%2C");
        const marker = `${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
        canvas.innerHTML = `<iframe class="site-map-embed" title="Map of ${esc(name)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${marker}" loading="eager" referrerpolicy="no-referrer"></iframe>`;
    }
    function openInternalLocationMap(name, lat, lon) {
        let modal = document.getElementById("siteMapModal");
        if (!modal) { modal = document.createElement("section"); modal.id = "siteMapModal"; modal.className = "site-map-modal"; document.body.append(modal); }
        modal.innerHTML = `<div class="site-map-dialog"><button class="site-map-close" type="button" aria-label="Close map">×</button><span>🗺️ IN-APP MAP</span><h2>${esc(name)}</h2><p>Location shown inside ARS Tourist Guide.</p><div id="siteMapCanvas"></div></div>`;
        const latitude = Number(lat), longitude = Number(lon), canvas = document.getElementById("siteMapCanvas");
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { canvas.innerHTML = "<p>Map coordinates are not available for this location yet.</p>"; return; }
        if (!window.L) { showSiteMapEmbed(canvas, name, latitude, longitude); return; }
        const map = L.map(canvas).setView([latitude, longitude], 15);
        let loadedTiles = 0;
        const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 });
        tiles.on("tileload", () => { loadedTiles += 1; }); tiles.addTo(map);
        const marker = L.divIcon({ className: "ars-map-pin", html: '<span aria-hidden="true">📍</span>', iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30] });
        L.marker([latitude, longitude], { icon: marker }).addTo(map).bindPopup(`<b>${esc(name)}</b>`).openPopup();
        requestAnimationFrame(() => map.invalidateSize());
        window.setTimeout(() => { if (!loadedTiles && document.getElementById("siteMapCanvas") === canvas) { map.remove(); showSiteMapEmbed(canvas, name, latitude, longitude); } }, 3500);
    }
    document.addEventListener("click", event => { const button = event.target.closest("[data-inline-map-name]"); if (button) openInternalLocationMap(button.dataset.inlineMapName, button.dataset.inlineMapLat, button.dataset.inlineMapLon); if (event.target.closest(".site-map-close")) document.getElementById("siteMapModal")?.remove(); });
    function renderLiveItems(items, kind, destination) {
        const grid = document.getElementById(kind === "hotel" ? "liveHotelsGrid" : kind === "food" ? "liveFoodGrid" : "livePlacesGrid"); if (!grid || !items.length) return;
        const hotelPhoto = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80";
        const placePhoto = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80";
        const foodPhotos = ["photo-1585937421612-70a008356fbe", "photo-1501339847302-ac426a4a7cbb", "photo-1517248135467-4c7edcad34c4"];
        grid.innerHTML = items.map((item, index) => kind === "hotel" ? `<article class="hotel-card"><div class="hotel-image"><img src="${hotelPhoto}" alt="Stay near ${esc(destination)}" loading="lazy"></div><div><span class="rating">🏨 ${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>📍 ${esc(item.address || `Near ${destination}`)}</p><strong>View location in our map</strong>${internalMapButton(item, "View stay map")}</div></article>` : kind === "food" ? `<article class="food-card"><div class="food-image"><img src="https://images.unsplash.com/${foodPhotos[index % foodPhotos.length]}?auto=format&fit=crop&w=900&q=85" alt="Food near ${esc(destination)}" loading="lazy"></div><span class="food-type">${esc(item.category || 'FOOD')}</span><h3>${esc(item.name)}</h3><p>📍 ${esc(item.address || `Near ${destination}`)}</p><span class="live-price-note">Open this restaurant on the in-app map</span>${internalMapButton(item, "Open restaurant map →")}</article>` : `<article class="place-card"><div class="place-image"><img src="${placePhoto}" alt="${esc(item.name)}" loading="lazy"></div><div class="place-content"><span>${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || `Near ${destination}`)}</p>${internalMapButton(item, "View details & map")}</div></article>`).join("");
    }
    async function loadLiveDestination(destination) {
        const [weather, places, hotels, food] = await Promise.allSettled([api(`/api/weather?destination=${encodeURIComponent(destination)}`), api(`/api/places?destination=${encodeURIComponent(destination)}`), api(`/api/places?kind=hotel&destination=${encodeURIComponent(destination)}`), api(`/api/places?kind=food&destination=${encodeURIComponent(destination)}`)]);
        if (weather.status === "fulfilled") renderWeather(weather.value);
        if (places.status === "fulfilled") renderLiveItems(places.value.items, "place", destination);
        if (hotels.status === "fulfilled") { renderLiveItems(hotels.value.items, "hotel", destination); setText("hotelHeading", `Best hotels in ${destination}`); }
        if (food.status === "fulfilled") { renderLiveItems(food.value.items, "food", destination); setText("foodHeading", `Popular food in ${destination}`); }
        return { weather: weather.status === "fulfilled" ? weather.value : null, places: places.status === "fulfilled" ? places.value.items : [] };
    }
    function loadAndScroll(selector) {
        const destination = getDestination();
        if (destination) loadLiveDestination(destination);
        document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.scrollToWeatherSection = () => loadAndScroll("#weatherSection");
    window.scrollToBestPlacesSection = () => loadAndScroll(".places-section");
    window.scrollToHotelSection = () => loadAndScroll("#hotels");
    window.scrollToTransportSection = async () => {
        const container = document.getElementById("transportResults");
        const destination = getDestination();
        if (!destination) { if (container) container.innerHTML = "<p>Please enter a destination first.</p>"; document.querySelector("#transportSection")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        if (container) container.innerHTML = "<p>Loading nearby train and bus stations…</p>";
        document.querySelector("#transportSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        try {
            const data = await api(`/api/places?kind=transport&destination=${encodeURIComponent(destination)}`);
            const cards = data.items.length ? data.items.map(item => `<article class="transport-card"><span>🚆 ${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || "Nearby transport point")}</p>${internalMapButton(item, "Open map here")}</article>`).join("") : "<p>No named nearby stations found. Try another destination.</p>";
            if (container) container.innerHTML = `${cards}<article class="transport-card"><span>🗺️ Route planner</span><h3>Live transit directions</h3><p>Select any nearby station above to view it on the in-app map.</p></article>`;
        } catch (error) {
            if (container) container.innerHTML = `<article class="transport-card"><span>🗺️ Maps fallback</span><h3>Live transit directions</h3><p>Station data is temporarily unavailable. Please try again in a moment.</p></article>`;
        }
    };
    async function loadLiveCategory(kind, sectionId, resultId, icon, fallbackText) {
        const container = document.getElementById(resultId);
        const destination = getDestination();
        document.querySelector(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!destination) { if (container) container.innerHTML = "<p>Please enter a destination first.</p>"; return; }
        if (container) container.innerHTML = "<p>Loading live nearby results…</p>";
        try {
            const data = await api(`/api/places?kind=${kind}&destination=${encodeURIComponent(destination)}`);
            if (container) container.innerHTML = data.items.length ? data.items.map(item => `<article class="transport-card"><span>${icon} ${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || fallbackText)}</p>${internalMapButton(item, "Open map here")}</article>`).join("") : `<p>No named nearby results found for ${esc(destination)}.</p>`;
        } catch (error) { if (container) container.innerHTML = `<p>${esc(error.message)}</p>`; }
    }
    window.scrollToFoodSection = () => loadLiveCategory("food", "#foodLiveSection", "foodResults", "🍛", "Nearby restaurant or café");
    window.scrollToEmergencySection = () => loadLiveCategory("emergency", "#emergencySection", "emergencyResults", "🏥", "Emergency service location");
    window.generateTripPlan = async () => {
        const destination = getDestination(); const days = Number(document.getElementById("days")?.value) || 3; const travellers = Number(document.getElementById("travellers")?.value) || 1; const perPersonBudget = Number(document.getElementById("budget")?.value) || 0;
        const startDate = document.getElementById("startDate")?.value || ""; const endDate = document.getElementById("endDate")?.value || "";
        const startCity = document.getElementById("startCity")?.value.trim() || ""; const viaCities = document.getElementById("viaCities")?.value.trim() || ""; const interests = document.getElementById("interests")?.value.trim() || "";
        const transportType = document.getElementById("transportType")?.value || "any"; const hotelClass = document.getElementById("hotelClass")?.value || "mid-range";
        // The planner budget is a total for the full travelling group. Do not
        // multiply it by the number of travellers again.
        const budget = perPersonBudget;
        if (!destination) return alert("Please enter your destination.");
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if ((startDate && startDate < today) || (endDate && endDate < today)) return alert("Travel dates cannot be in the past. Please choose today or a future date.");
        if (startDate && endDate && endDate < startDate) return alert("The end date must be after the start date.");
        const results = document.getElementById("resultContent"); if (results) results.innerHTML = `<div class="empty-result"><div>⏳</div><h3>Creating your trip plan…</h3><p>Loading weather and nearby places for ${esc(destination)}.</p></div>`;
        try {
            // A trip plan must not wait for map/weather providers. Those live
            // cards load in the background and may be temporarily slow.
            const plan = await api("/api/ai/plan", { method: "POST", body: JSON.stringify({ destination, days, travellers, budget, startDate, endDate, startCity, viaCities, interests, transportType, hotelClass }) });
            const live = { weather: null, places: [] };
            loadLiveDestination(destination).catch(() => {});
            const split = { hotel: Math.round(budget * 0.45), food: Math.round(budget * 0.25), transport: Math.round(budget * 0.20), tickets: Math.round(budget * 0.10) };
            window.currentPlan = { ...plan, days, travellers, budget, perPersonBudget, startDate, endDate, startCity, viaCities, interests, transportType, hotelClass, estimatedTotal: budget, budgetSplit: split };
            window.recordActivity("Created trip plan", `${plan.title || destination} · ${days} days`);
            // Keep the most recent itinerary available to the audio guide after
            // a refresh. This contains only the trip details already shown here.
            localStorage.setItem("arsAudioGuidePlan", JSON.stringify(window.currentPlan));
            window.currentPlanId = null;
            const daily = (plan.dailyPlan || []).map(day => `<div class="timeline-day"><strong>Day ${esc(day.day)}:</strong><div class="time-slots"><span>🕘 Morning: ${esc(day.morning)}</span><span>☀️ Afternoon: ${esc(day.afternoon)}</span><span>🌙 Evening: ${esc(day.evening)}</span></div></div>`).join("");
            const livePlaces = live.places.slice(0, 5).map(item => item.name).join(" • ") || (plan.places || []).join(" • ");
            const weatherAlert = live.weather && (live.weather.rain > 0 || live.weather.wind >= 30) ? `⚠️ ${live.weather.rain > 0 ? "Rain is possible" : "Strong wind reported"}; keep an alternative indoor activity and check conditions before leaving.` : "✅ No current weather warning. Recheck the live weather before outdoor activities.";
            const label = plan.mode === "ai" ? "✨ Personalized itinerary" : plan.mode === "free-fallback" ? "🧭 Travel itinerary" : "🧭 Trip outline";
            if (results) results.innerHTML = `<div class="ai-result"><div class="ai-result-header"><p class="trip-badge">${label}</p><h2>Your Trip Plan for ${esc(plan.title || destination)}</h2><p>${esc(plan.description)}</p><div class="info-action-box"><div class="trip-badges-container"><span class="trip-badge">📅 ${days} Days</span><span class="trip-badge">👥 ${travellers} Traveller(s)</span>${startDate ? `<span class="trip-badge">🗓️ ${esc(startDate)}${endDate ? ` → ${esc(endDate)}` : ""}</span>` : ""}${perPersonBudget ? `<span class="trip-badge">💰 ₹${perPersonBudget.toLocaleString()} total group budget</span>` : ""}</div><div class="result-action-btns"><button class="action-btn save" onclick="saveItinerary()">🔖 Save Plan</button><button class="action-btn" onclick="shareItinerary()">🔗 Share</button><button class="action-btn" onclick="printItinerary()">🖨️ Save PDF</button><a class="action-btn map" href="live.html?type=map&destination=${encodeURIComponent(destination)}">🗺️ Route & maps</a></div></div></div><div class="result-grid"><div class="result-box"><h3>💰 Estimated group budget</h3><p>Hotel: ₹${split.hotel.toLocaleString()}<br>Food: ₹${split.food.toLocaleString()}<br>Transport: ₹${split.transport.toLocaleString()}<br>Tickets: ₹${split.tickets.toLocaleString()}<br><strong>Total: ₹${budget.toLocaleString()}</strong></p></div><div class="result-box"><h3>📍 Live places nearby</h3><p>${esc(livePlaces)}</p></div><div class="result-box"><h3>🏨 ${esc(hotelClass)} stay advice</h3><p>${esc(plan.hotel)}</p></div><div class="result-box"><h3>🍴 Must try</h3><p>${esc((plan.food || []).join(" • "))}</p></div><div class="result-box"><h3>🎒 Pack</h3><p>${esc((plan.checklist || []).join(" • "))}</p></div><div class="result-box"><h3>🌤️ Weather alert</h3><p>${esc(weatherAlert)}<br>${esc(plan.weather)}</p></div></div><div style="padding:0 25px 25px;background:#f8fbfc"><div class="timeline-container"><h4>📅 Day-by-day itinerary</h4>${daily}</div></div></div>`;
            document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) { if (results) results.innerHTML = `<div class="empty-result start-server-help"><div>⚠️</div><h3>Trip plan could not be created</h3><p>${esc(error.message)}</p><div class="server-steps"><strong>How to start the website</strong><span>1. Double-click <b>start.bat</b></span><span>2. Use the browser tab at <b>http://localhost:3010</b></span><span>3. Do not open <b>index.HTML</b> directly</span></div></div>`; }
    };
    window.generateAIPlan = window.generateTripPlan;
    window.printItinerary = () => window.print();
    let audioGuideSpeech = null;
    let audioGuideKeepAlive = null;
    const setAudioGuideState = (buttonText, message) => {
        const button = document.getElementById("audioGuideButton"); const status = document.getElementById("audioGuideStatus");
        if (button) button.textContent = buttonText;
        if (status) status.textContent = message;
    };
    window.playAudioGuide = () => {
        if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
            setAudioGuideState("▶ Play audio guide", "Audio playback is unavailable in this browser.");
            alert("Audio playback is unavailable in this browser. Please open http://localhost:3010 in Chrome, Edge, or Safari and try again.");
            return;
        }
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume(); setAudioGuideState("⏸ Pause audio guide", "Audio guide is playing."); return;
        }
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause(); setAudioGuideState("▶ Resume audio guide", "Audio guide is paused."); return;
        }
        let plan = window.currentPlan || currentPlan;
        if (!plan) {
            try { plan = JSON.parse(localStorage.getItem("arsAudioGuidePlan") || "null"); } catch { /* Ignore malformed saved data. */ }
        }
        if (!plan) {
            setAudioGuideState("▶ Play audio guide", "Generate a trip plan first, then play its audio guide.");
            alert("Please generate a trip plan first, then press Play audio guide.");
            return;
        }

        const itinerary = (plan.dailyPlan || []).map(day =>
            `Day ${day.day}. Morning: ${day.morning}. Afternoon: ${day.afternoon}. Evening: ${day.evening}.`
        ).join(" ");
        const message = `${plan.title || "Your trip"}. ${plan.description || "Here is your itinerary."} ${itinerary || "Your day-by-day itinerary is ready."}`;
        const speech = new SpeechSynthesisUtterance(message.replace(/\s+/g, " ").trim());
        audioGuideSpeech = speech;
        speech.lang = navigator.language || "en-IN";
        speech.rate = 0.95;
        speech.onstart = () => setAudioGuideState("⏸ Pause audio guide", "Audio guide is playing. Keep this tab open while listening.");
        speech.onend = () => { window.clearInterval(audioGuideKeepAlive); audioGuideKeepAlive = null; audioGuideSpeech = null; setAudioGuideState("▶ Play audio guide", "Audio guide finished. Press play to hear it again."); };
        speech.onerror = event => {
            window.clearInterval(audioGuideKeepAlive); audioGuideKeepAlive = null; audioGuideSpeech = null; setAudioGuideState("▶ Play audio guide", "Audio could not start. Check device volume and try again.");
            if (event.error !== "interrupted" && event.error !== "canceled") {
                alert("Audio could not start. Please check that your device volume is on and try again.");
            }
        };
        window.speechSynthesis.cancel();
        // Speak directly inside the button click. Delaying this can cause Chrome
        // and Edge to reject audio because the user gesture has already ended.
        window.speechSynthesis.speak(speech);
        audioGuideKeepAlive = window.setInterval(() => { if (window.speechSynthesis.speaking) window.speechSynthesis.resume(); }, 10_000);
        setAudioGuideState("⏸ Pause audio guide", "Starting audio guide…");
    };
    window.shareItinerary = async () => {
        if (!window.currentPlan) return; if (!isLoggedIn()) return window.openAuth();
        try {
            if (!window.currentPlanId) { const saved = await api("/api/plans", { method: "POST", body: JSON.stringify({ plan: window.currentPlan }) }); window.currentPlanId = saved.id; }
            const shared = await api(`/api/plans/${window.currentPlanId}/share`, { method: "POST" });
            const text = `${window.currentPlan.title}: collaborate on this ${window.currentPlan.days}-day trip plan.`;
            if (navigator.share) await navigator.share({ title: `${window.currentPlan.title} trip plan`, text, url: shared.url }); else { await navigator.clipboard.writeText(shared.url); alert("Editable collaboration link copied."); }
        } catch (error) { if (error.name !== "AbortError") alert(error.message || "Could not share the plan."); }
    };
    const chatHistory = [];
    function addChatMessage(className, message) {
        const messages = document.getElementById("chatMessages"); if (!messages) return;
        const bubble = document.createElement("div"); bubble.className = className; bubble.textContent = message; messages.appendChild(bubble); messages.scrollTop = messages.scrollHeight;
    }
    window.toggleChat = () => {
        const chatWindow = document.getElementById("chatWindow");
        if (!chatWindow) return;
        const opening = chatWindow.style.display !== "block"; chatWindow.style.display = opening ? "block" : "none";
        if (opening) document.getElementById("chatInput")?.focus();
    };
    window.askTravelAssistant = message => {
        const input = document.getElementById("chatInput"); if (!input) return;
        input.value = message; window.sendMessage();
    };
    window.sendMessage = async () => {
        const input = document.getElementById("chatInput"); const message = input?.value.trim();
        if (!message) return;
        addChatMessage("user-message", message); input.value = ""; chatHistory.push({ role: "user", content: message });
        const typing = document.createElement("div"); typing.className = "bot-message"; typing.textContent = "Thinking…"; document.getElementById("chatMessages")?.appendChild(typing);
        try {
            const data = await api("/api/ai/chat", { method: "POST", body: JSON.stringify({ message, history: chatHistory.slice(-8, -1), destination: getDestination() }) });
            typing.remove(); chatHistory.push({ role: "assistant", content: data.answer });
            document.getElementById("chatStatus").textContent = data.mode === "ai" ? "● Travel assistant online" : "● Travel guidance";
            addChatMessage("bot-message", data.answer);
        } catch (error) { typing.remove(); addChatMessage("bot-message", `Sorry, ${error.message}`); }
    };
    window.handleChat = event => { if (event.key === "Enter") window.sendMessage(); };
    window.saveItinerary = async () => {
        if (!window.currentPlan) return; if (!isLoggedIn()) return window.openAuth();
        try { const saved = await api("/api/plans", { method: "POST", body: JSON.stringify({ plan: window.currentPlan }) }); window.currentPlanId = saved.id; alert("Trip plan saved to your account."); } catch (error) { alert(error.message); }
    };
    window.renderSavedPlans = async () => {
        const container = document.getElementById("savedPlansContainer"); if (!container) return;
        if (!isLoggedIn()) { container.innerHTML = "<p>Please log in to see saved trips.</p>"; return; }
        try { const plans = await api("/api/plans"); container.innerHTML = plans.length ? plans.map(plan => `<div class="saved-plan-card"><h3>${esc(plan.title)} (${plan.days} Days)</h3><p>Travellers: ${plan.travellers} | Budget: ₹${Number(plan.budget || 0).toLocaleString()}</p><button class="delete-plan-btn" onclick="deleteSavedPlan(${plan.id})">🗑️ Delete Plan</button></div>`).join("") : "<p>No saved plans yet.</p>"; } catch (error) { container.textContent = error.message; }
    };
    window.deleteSavedPlan = async id => { try { await api(`/api/plans/${id}`, { method: "DELETE" }); window.renderSavedPlans(); } catch (error) { alert(error.message); } };
    window.convertCurrency = async () => {
        const amount = Number(document.getElementById("currencyAmount")?.value); const from = document.getElementById("currencySource")?.value; const result = document.getElementById("currencyResult");
        if (!amount || !from) { if (result) result.textContent = "Enter an amount and choose a currency first."; return; }
        if (result) result.textContent = "Converting to Indian Rupees…";
        try { const data = await api(`/api/currency/convert?from=${encodeURIComponent(from)}&to=INR&amount=${amount}`); if (result) result.textContent = `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(data.converted)} · 1 ${data.from} = ₹${data.rate.toFixed(4)} (${data.date || "live"})`; } catch (error) { if (result) result.textContent = error.message; }
    };
    window.calculateCarbon = () => {
        const distance = Number(document.getElementById('carbonDistance')?.value); const mode = document.getElementById('carbonTransport')?.value; const result = document.getElementById('carbonResult');
        const factors = { flight: .255, car: .171, bus: .105, train: .041 }; if (!distance || !factors[mode]) { if (result) result.textContent = 'Enter a distance first.'; return; }
        const kg = distance * factors[mode]; const lowest = distance * factors.train; if (result) result.textContent = `${kg.toFixed(1)} kg CO₂e estimated. ${mode !== 'train' ? `Train could be about ${(kg - lowest).toFixed(1)} kg lower for this distance.` : 'Train is the lowest-impact option shown.'}`;
    };
    document.addEventListener("DOMContentLoaded", async () => {
        try {
            const session = await api("/api/auth/session");
            if (session.user) localStorage.setItem("arsUser", JSON.stringify(session.user));
            else localStorage.removeItem("arsUser");
        } catch { localStorage.removeItem("arsUser"); }
        updateServerAuthButton(); renderFeedback();
    });
})();
