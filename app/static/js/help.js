// Help page scripts

document.addEventListener('DOMContentLoaded', function() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleDateString();
});

function openSupportTicket() {
    alert('Support ticket system coming soon! Please contact us via email or phone.');
}

// expose
window.openSupportTicket = openSupportTicket;



