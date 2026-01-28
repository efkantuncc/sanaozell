import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, push, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDnUMw2ws-v1l_eVUP5wqjMAZP8bAkv7BI",
    authDomain: "ekdate-12fe4.firebaseapp.com",
    databaseURL: "https://ekdate-12fe4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ekdate-12fe4",
    storageBucket: "ekdate-12fe4.firebasestorage.app",
    messagingSenderId: "904664644650",
    appId: "1:904664644650:web:d941eea2b7ee7e4c075753"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let currentUser = null;
let currentUserData = null;
let allUsers = [];
let currentDiscoverIndex = 0;
let likedUsers = [];
let dislikedUsers = [];
let matches = [];
let currentChatUser = null;

// Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await checkProfileSetup();
        await loadAllUsers();
        await loadLikesAndMatches();
        showNextProfile();
        loadMatches();
        loadChats();
    } else {
        window.location.href = 'app.html';
    }
});

// Load user data
async function loadUserData() {
    const userRef = ref(database, 'users/' + currentUser.uid);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        currentUserData = snapshot.val();
        
        // Update header
        document.getElementById('headerName').textContent = currentUserData.name;
        if (currentUserData.photo) {
            document.getElementById('headerAvatar').src = currentUserData.photo;
        } else {
            document.getElementById('headerAvatar').src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23FF2D55" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="white">' + currentUserData.name.charAt(0) + '</text></svg>';
        }
    }
}

// Check profile setup
async function checkProfileSetup() {
    if (!currentUserData.profileSetup) {
        document.getElementById('profileSetupPopup').style.display = 'flex';
    }
}

// Load all users
async function loadAllUsers() {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        allUsers = [];
        snapshot.forEach((childSnapshot) => {
            const userId = childSnapshot.key;
            const userData = childSnapshot.val();
            
            // Filter: not current user, matching preferences, has profile setup
            if (userId !== currentUser.uid && userData.profileSetup) {
                // Check gender preference
                if (currentUserData.interestedIn === 'both' || 
                    currentUserData.interestedIn === userData.gender) {
                    allUsers.push({
                        id: userId,
                        ...userData
                    });
                }
            }
        });
        
        // Shuffle users
        allUsers.sort(() => Math.random() - 0.5);
    }
}

// Load likes and matches
async function loadLikesAndMatches() {
    const likesRef = ref(database, 'likes/' + currentUser.uid);
    const snapshot = await get(likesRef);
    
    if (snapshot.exists()) {
        const data = snapshot.val();
        likedUsers = data.liked || [];
        dislikedUsers = data.disliked || [];
    }
    
    const matchesRef = ref(database, 'matches/' + currentUser.uid);
    const matchesSnapshot = await get(matchesRef);
    
    if (matchesSnapshot.exists()) {
        matches = Object.keys(matchesSnapshot.val());
    }
}

// Show next profile
function showNextProfile() {
    const discoverContent = document.getElementById('discoverContent');
    
    // Filter out already liked/disliked/matched users
    const availableUsers = allUsers.filter(user => 
        !likedUsers.includes(user.id) && 
        !dislikedUsers.includes(user.id) &&
        !matches.includes(user.id)
    );
    
    if (availableUsers.length === 0) {
        discoverContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <h3>Herkesi Gördün!</h3>
                <p>Şu an için gösterilecek yeni profil yok. Biraz sonra tekrar kontrol et!</p>
            </div>
        `;
        return;
    }
    
    const user = availableUsers[0];
    const age = calculateAge(user.birthdate);
    
    const verifiedBadge = user.verified == 1 
        ? (user.admin == 1 
            ? '<span class="verified-badge admin-verified">✓</span><span class="admin-badge">ADMIN</span>' 
            : '<span class="verified-badge verified-blue">✓</span>')
        : '';
    
    discoverContent.innerHTML = `
        <div class="profile-card">
            <div class="profile-image-container">
                <img src="${user.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%23FF2D55" width="400" height="500"/><text x="200" y="250" font-size="120" text-anchor="middle" dy=".3em" fill="white">' + user.name.charAt(0) + '</text></svg>'}" alt="${user.name}" class="profile-image">
                <div class="profile-overlay">
                    <div class="profile-name">
                        ${user.name} ${verifiedBadge}
                        <span class="profile-age">- ${age}</span>
                    </div>
                </div>
            </div>
            <div class="profile-info">
                <p class="profile-bio">${user.bio || 'Bio yok'}</p>
            </div>
            <div class="action-buttons">
                <button class="action-btn reject-btn" onclick="handleReject('${user.id}')">✕</button>
                <button class="action-btn like-btn" onclick="handleLike('${user.id}')">❤</button>
            </div>
        </div>
    `;
}

// Calculate age
function calculateAge(birthdate) {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// Handle like
window.handleLike = async function(userId) {
    likedUsers.push(userId);
    await update(ref(database, 'likes/' + currentUser.uid), {
        liked: likedUsers
    });
    
    // Check if other user also liked
    const otherUserLikesRef = ref(database, 'likes/' + userId);
    const snapshot = await get(otherUserLikesRef);
    
    if (snapshot.exists()) {
        const otherUserLikes = snapshot.val().liked || [];
        
        if (otherUserLikes.includes(currentUser.uid)) {
            // It's a match!
            await createMatch(userId);
            showMatchNotification();
        }
    }
    
    showNextProfile();
}

// Handle reject
window.handleReject = async function(userId) {
    dislikedUsers.push(userId);
    await update(ref(database, 'likes/' + currentUser.uid), {
        disliked: dislikedUsers
    });
    
    showNextProfile();
}

// Create match
async function createMatch(userId) {
    await set(ref(database, 'matches/' + currentUser.uid + '/' + userId), true);
    await set(ref(database, 'matches/' + userId + '/' + currentUser.uid), true);
    matches.push(userId);
}

// Show match notification
function showMatchNotification() {
    // Simple alert for now - you can make this fancier
    alert('🎉 Eşleşme! Artık mesajlaşabilirsiniz!');
}

// Load matches
async function loadMatches() {
    const matchesGrid = document.getElementById('matchesGrid');
    
    if (matches.length === 0) {
        matchesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">💔</div>
                <h3>Henüz Eşleşme Yok</h3>
                <p>Keşfet sekmesinden insanları beğenmeye başla!</p>
            </div>
        `;
        return;
    }
    
    matchesGrid.innerHTML = '';
    
    for (const matchId of matches) {
        const userRef = ref(database, 'users/' + matchId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            const age = calculateAge(user.birthdate);
            
            const verifiedBadge = user.verified == 1 
                ? (user.admin == 1 
                    ? '<span class="verified-badge admin-verified">✓</span><span class="admin-badge">ADMIN</span>' 
                    : '<span class="verified-badge verified-blue">✓</span>')
                : '';
            
            const card = document.createElement('div');
            card.className = 'match-card';
            card.onclick = () => openChat(matchId);
            card.innerHTML = `
                <div class="match-image-container">
                    <img src="${user.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%235E60CE" width="400" height="500"/><text x="200" y="250" font-size="120" text-anchor="middle" dy=".3em" fill="white">' + user.name.charAt(0) + '</text></svg>'}" alt="${user.name}" class="match-image">
                </div>
                <div class="match-info">
                    <div class="match-name">
                        ${user.name} ${verifiedBadge}
                        <span class="profile-age">- ${age}</span>
                    </div>
                    <p class="match-bio">${user.bio || 'Bio yok'}</p>
                </div>
            `;
            
            matchesGrid.appendChild(card);
        }
    }
}

// Load chats
async function loadChats() {
    const chatList = document.getElementById('chatList');
    
    if (matches.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <p>Henüz eşleşme yok</p>
            </div>
        `;
        return;
    }
    
    chatList.innerHTML = '';
    
    for (const matchId of matches) {
        const userRef = ref(database, 'users/' + matchId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            
            const verifiedBadge = user.verified == 1 
                ? (user.admin == 1 
                    ? '<span class="verified-badge admin-verified">✓</span>' 
                    : '<span class="verified-badge verified-blue">✓</span>')
                : '';
            
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.onclick = () => openChat(matchId);
            chatItem.innerHTML = `
                <img src="${user.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%235E60CE" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="white">' + user.name.charAt(0) + '</text></svg>'}" alt="${user.name}" class="chat-avatar">
                <div class="chat-details">
                    <div class="chat-name">${user.name} ${verifiedBadge}</div>
                    <div class="chat-preview">Mesajlaşmaya başla</div>
                </div>
            `;
            
            chatList.appendChild(chatItem);
        }
    }
}

// Open chat
async function openChat(userId) {
    currentChatUser = userId;
    
    // Remove active class from all chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active to clicked item
    event.currentTarget.classList.add('active');
    
    const userRef = ref(database, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        const user = snapshot.val();
        
        const verifiedBadge = user.verified == 1 
            ? (user.admin == 1 
                ? '<span class="verified-badge admin-verified">✓</span><span class="admin-badge">ADMIN</span>' 
                : '<span class="verified-badge verified-blue">✓</span>')
            : '';
        
        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML = `
            <div class="chat-header">
                <img src="${user.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%235E60CE" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="white">' + user.name.charAt(0) + '</text></svg>'}" alt="${user.name}" class="chat-avatar">
                <div class="chat-details">
                    <div class="chat-name">${user.name} ${verifiedBadge}</div>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages"></div>
            <div class="chat-input-container">
                <input type="text" class="chat-input" id="messageInput" placeholder="Mesajını yaz...">
                <button class="send-btn" onclick="sendMessage()">Gönder</button>
            </div>
        `;
        
        // Load messages
        loadMessages(userId);
        
        // Listen for Enter key
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Switch to messages tab
    switchMainTab('messages');
}

// Load messages
function loadMessages(userId) {
    const chatId = [currentUser.uid, userId].sort().join('_');
    const messagesRef = ref(database, 'messages/' + chatId);
    
    onValue(messagesRef, (snapshot) => {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        if (snapshot.exists()) {
            const messages = [];
            snapshot.forEach((childSnapshot) => {
                messages.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Sort by timestamp
            messages.sort((a, b) => a.timestamp - b.timestamp);
            
            messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = msg.senderId === currentUser.uid ? 'message sent' : 'message received';
                messageDiv.textContent = msg.text;
                chatMessages.appendChild(messageDiv);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// Send message
window.sendMessage = async function() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text || !currentChatUser) return;
    
    const chatId = [currentUser.uid, currentChatUser].sort().join('_');
    const messagesRef = ref(database, 'messages/' + chatId);
    
    await push(messagesRef, {
        senderId: currentUser.uid,
        text: text,
        timestamp: Date.now()
    });
    
    messageInput.value = '';
}

// Complete profile
window.completeProfile = async function(event) {
    event.preventDefault();
    
    const birthdate = document.getElementById('birthdate').value;
    const bio = document.getElementById('bio').value;
    const photoBase64 = document.getElementById('imagePreview').querySelector('img')?.src || '';
    
    // Check age
    const age = calculateAge(birthdate);
    if (age < 18) {
        alert('18 yaşından küçükler kayıt olamaz!');
        return;
    }
    
    await update(ref(database, 'users/' + currentUser.uid), {
        birthdate: birthdate,
        bio: bio,
        photo: photoBase64,
        profileSetup: true
    });
    
    document.getElementById('profileSetupPopup').style.display = 'none';
    location.reload();
}

// Handle image upload
window.handleImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

// Switch main tab
window.switchMainTab = function(tabName) {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    if (tabName === 'discover') {
        tabs[0].classList.add('active');
        document.getElementById('discoverTab').classList.add('active');
    } else if (tabName === 'matches') {
        tabs[1].classList.add('active');
        document.getElementById('matchesTab').classList.add('active');
        loadMatches();
    } else if (tabName === 'messages') {
        tabs[2].classList.add('active');
        document.getElementById('messagesTab').classList.add('active');
    }
}

// Logout
window.logout = async function() {
    await signOut(auth);
    window.location.href = 'app.html';
}