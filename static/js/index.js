const sipLoginButton = document.getElementById('sipLogin');
const loginButton = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');


sipLoginButton.addEventListener('click', () => {
    storeLoginDetails();
    window.open('phone.html', 'sipClient', 'width=500,height=464');
});

loginButton.addEventListener('click', () => {
    login();
});

function login() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

function storeLoginDetails() {
    const sipUser = document.getElementById('sipUser').value;
    const sipPass = document.getElementById('sipPass').value;
    const sipServer = document.getElementById('sipServer').value;
    const wssServer = document.getElementById('wssServer').value;

    if (sipUser && sipPass && sipServer && wssServer) {
        localStorage.setItem('sipUser', sipUser);
        localStorage.setItem('sipPass', sipPass);
        localStorage.setItem('sipServer', sipServer);
        localStorage.setItem('wssServer', wssServer);
        console.log('Login details stored successfully.');
    } else {
        console.error('Please fill in all fields.');
    }
}

function getStoredLoginDetails() {
    const sipUser = localStorage.getItem('sipUser');
    const sipPass = localStorage.getItem('sipPass');
    const sipServer = localStorage.getItem('sipServer');
    const wssServer = localStorage.getItem('wssServer');

    if (sipUser && sipPass && sipServer && wssServer) {
        document.getElementById('sipUser').value = sipUser;
        document.getElementById('sipPass').value = sipPass;
        document.getElementById('sipServer').value = sipServer;
        document.getElementById('wssServer').value = wssServer;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    getStoredLoginDetails();
});