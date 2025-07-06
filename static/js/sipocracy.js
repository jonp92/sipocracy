// Constants
import { logMe } from './logme.js'; // Import the logging class
const logger = new logMe("sipocracy", "debug"); // Initialize logger with name and log level
const sipLogLevel = "error"; // Set SIP.js log level
const mediaElement = document.getElementById('mediaElement');
const statusLed = document.querySelector('.status-led');
const storedCalls = JSON.parse(localStorage.getItem('callHistory')) || [];
const dtmfButtons = document.querySelectorAll('.dtmfButton');
const dialerBtn = document.getElementById('dialerBtn');
const dtmfButtonsContainer = document.getElementById('dtmfButtons');
const callButton = document.getElementById('callBtn');
const answerButton = document.getElementById('answerBtn');
const declineButton = document.getElementById('declineBtn');
const holdButton = document.getElementById('holdBtn');
const muteButton = document.getElementById('muteBtn');
const callerIdElement = document.getElementById('callerId');
const callerAvatarElement = document.getElementById('callerAvatar');
const transferButton = document.getElementById('transferBtn');
const conferenceButton = document.getElementById('conferenceBtn');
const hangupButton = document.getElementById('hangupBtn');
const durationElement = document.getElementById('callDuration');
const tabs = document.getElementById('tabs');
const callHistoryContainer = document.getElementById('callHistoryContainer');
const loginModalEl = document.getElementById('loginModal');
const loginModal = new bootstrap.Modal(loginModalEl, {});
const sipLoginButton = document.getElementById('sipLoginBtn');
const notificationTickler = document.getElementById('notification-tickler');
const callControls = document.getElementById('phoneTabItem');
const callActionButtons = document.getElementById('callActionButtons');
const callControlButtons = document.getElementById('callControlButtons');
const contactsList = document.getElementById('contactsList');
const contactListTab = document.getElementById('contactsTabItem');
const contactListBtn = document.getElementById('contactsTab');
const callHistoryTab = document.getElementById('callHistoryTabItem');
const callHistoryBtn = document.getElementById('callHistoryTab');
const dialerTab = document.getElementById('dialerTabItem');
const dialerTabBtn = document.getElementById('dialerTab');
const phoneTabBtn = document.getElementById('phoneTab');
const accountManager = document.getElementById('accountManager');
const accountName = document.getElementById('accountName');
const logoutButton = document.getElementById('logoutBtn');
const sipSettingsButton = document.getElementById('sipSettingsBtn');
const callNetStats = document.getElementById('callNetStats');
const audio = new Audio();

// Global variables
let session = null;
let userAgent = null;
let remoteStream = null;
let callCounterInterval = null; // For call duration counter
let firstLoad = true; // Flag to prevent duplicate entries in call history
let loggingOut = false; // Flag to prevent multiple logout attempts
let onHold = false; // Flag to track hold state
let isMuted = false; // Flag to track mute state

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('phone-sw.js', { scope: '/' })
      .then(reg => {
        logger.debug('Service Worker registered', reg)
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'CALL_ACTION') {
            if (event.data.action === 'answer') {
              // Call your function to answer the call here
              // For example: answerCurrentCall();
              if (session) {
                answerCurrentCall();
              }
            } else if (event.data.action === 'decline') {
              if (session) {
                playAudio('static/wav/unique_ringtone.wav', true, true); // Stop ringtone
                updateStatusLed('connected');
                const callInfo = {
                  number: session.remoteIdentity.uri.toString(),
                  time: Date.now(),
                  direction: 'missed' // Indicate this is a missed call
                };
                callHistoryHandler(callInfo); // Log the missed call in history
                session.reject();
              }
            }
          }
        });
      })
      .catch(err => logger.error('Service Worker registration failed', err));
  }
}

function checkPermissions() {
  if (Notification.permission === 'granted') {
    notificationTickler.classList.add('d-none');
    logger.debug('Notification permission already granted.');
  } else if (Notification.permission === 'default') {
    notificationTickler.classList.remove('d-none');
  } else {
    logger.error('Notification permission denied.');
  }
}

function answerCurrentCall() {
    if (session) {
      playAudio('static/wav/unique_ringtone.wav', true, true); // Stop ringtone
      session.accept();
      callDurationCounter(); // Start call duration counter
      updateStatusLed('in-call');
      const callInfo = {
        number: session.remoteIdentity.uri.toString(),
        time: Date.now(),
        direction: 'incoming' // Indicate this is an incoming call
      };
      callHistoryHandler(callInfo); // Log the call in history
  }
}

function setNotificationPermission() {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      notificationTickler.classList.add('d-none');
      logger.debug('Notification permission granted.');
    } else if (permission === 'denied') {
      notificationTickler.classList.add('d-none');
      logger.error('Notification permission denied.');
    } else {
      logger.warn('Notification permission dismissed.');
    }
  }).catch(err => {
    logger.error('Error requesting notification permission:', err);
  });
}

function updateStatusLed(status) {
  logger.debug(`Updating status LED to: ${status}`);
  if (!statusLed) return;
  const statusClasses = ['connected', 'disconnected', 'calling', 'ringing', 'in-call', 'dtmf'];
  statusClasses.forEach(cls => statusLed.classList.remove(cls));
  if (statusClasses.includes(status)) {
    statusLed.classList.add(status);
  } else {
    logger.warn(`Unknown status: ${status}`);
  }
}

function setupRemoteMedia(session) {
  const pc = session.sessionDescriptionHandler.peerConnection;
  pc.getReceivers().forEach(receiver => {
    if (receiver.track) {
        logger.debug('Adding remote track:', receiver.track);
      remoteStream.addTrack(receiver.track);
    }
  });

  mediaElement.srcObject = remoteStream;
  mediaElement.play();
}

function cleanupMedia() {
    logger.debug("Cleaning up Media")
    mediaElement.srcObject = null;
    mediaElement.pause();
}

function onInvite(invitation) {
  playAudio('static/wav/unique_ringtone.wav', true); // Play custom ringtone
  updateStatusLed('ringing');
  session = invitation;
  notifyIncomingCall(invitation);
  callerIdElement.textContent = session.remoteIdentity.displayName || session.remoteIdentity.uri.toString();
  invitation.stateChange.addListener((state) => {
    logger.info(`Session state changed to ${state}`);
    switch (state) {
      case SIP.SessionState.Established:
        callDurationCounter(); // Start call duration counter
        setupRemoteMedia(invitation);
        break;
      case SIP.SessionState.Terminating:
      case SIP.SessionState.Terminated:
        cleanupMedia();
        session = null;
        updateStatusLed('connected');
        if (callCounterInterval) {
          clearInterval(callCounterInterval);
          durationElement.textContent = '0:00'; // Reset call duration display
        }
        showCallControls(false, false); // Hide call controls
        showTabs(); // Show tabs
        break;
    }
  });
  
  showCallControls(true, false); // Show call controls with call actions, hide call controls

}

function playAudio(audioFile, loop = false, stop = false) {
  logger.debug(`Playing audio: ${audioFile}, loop: ${loop}, stop: ${stop}`);
  if (stop) {
    logger.debug(`Stopping audio playback for ${audioFile}`);
    audio.pause();
    audio.currentTime = 0;
    return;
  }
  audio.src = audioFile;
  audio.loop = loop;
  audio.play();
  audio.addEventListener('ended', () => {
    logger.debug(`Audio playback ended for ${audioFile}`);
    audio.remove(); // Clean up audio element after playback
  });
}

function makeCall(uri) {
  const target = SIP.UserAgent.makeURI(uri);
  callerIdElement.textContent = target.displayName || target.toString();
  const inviter = new SIP.Inviter(userAgent, target);
  session = inviter; // <-- Set session for outgoing call
  inviter.stateChange.addListener((state) => {
    logger.info(`Session state changed to ${state}`);
    switch (state) {
      case SIP.SessionState.Established:
        setupRemoteMedia(inviter);
        callDurationCounter(); // Start call duration counter
        logger.debug(`Current session: ${session._id}`);
        break;
      case SIP.SessionState.Terminating:
      case SIP.SessionState.Terminated:
        cleanupMedia();
        session = null; // Clear session when call ends
        updateStatusLed('connected');
        showCallControls(false, false); // Hide call controls
        showTabs(); // Show tabs
        break;
    }
  });
  inviter.invite();
  updateStatusLed('calling');
  const callInfo = {
    number: uri,
    time: Date.now(),
    direction: 'outgoing' // Indicate this is an outgoing call
  };
  callHistoryHandler(callInfo); // Log the call in history
  showCallControls(false, true); // Show call controls with call actions and call history
}

function endCall() {
  if (!session) return;
  if (callCounterInterval) {
    clearInterval(callCounterInterval);
    durationElement.textContent = '0:00'; // Reset call duration display
  }
  switch(session.state) {
    case SIP.SessionState.Initial:
    case SIP.SessionState.Establishing:
      if (session instanceof SIP.Inviter) {
        // An unestablished outgoing session
        session.cancel();
      } else if (session instanceof SIP.Invitation) {
        // An unestablished incoming session
        session.reject();
      }
      break;
    case SIP.SessionState.Established:
      // An established session
      session.bye();
      break;
    case SIP.SessionState.Terminating:
    case SIP.SessionState.Terminated:
      // Cannot terminate a session that is already terminated
      break;
  }
}

function sendDTMF(signal, duration = 1000) {
  if (!session || session.state !== SIP.SessionState.Established) {
    alert("No active call to send DTMF.");
    return;
  }
  const options = {
    requestOptions: {
      body: {
        contentDisposition: "render",
        contentType: "application/dtmf-relay",
        content: `Signal=${signal}\r\nDuration=${duration}`
      }
    }
  };
  session.info(options);
  statusLed.classList.add('dtmf');
  statusLed.addEventListener('transitionend', () => {
    statusLed.classList.remove('dtmf');
  }, { once: true });

  // Optionally, you can also play a sound for DTMF
}

function checkforPhoneNumber() {
  const calleeInput = document.getElementById('callee');
  let callee = calleeInput.value.trim();
  if (!callee.includes('@')) {
    callee = `sip:${callee}@${userAgent.configuration.uri.host}`;
    logger.debug(`No SIP URI provided, using default host: ${callee}`);
  }
  const phoneRegex = /^\+?[0-9\s-]+$/; // Basic phone number regex
  if (phoneRegex.test(callee)) {
    logger.debug(`Valid phone number detected: ${callee}`);
  } else {
    logger.debug(`Invalid phone number format: ${callee}`);
  }
  return callee;
}

function transferCall(blindTransfer = true, targetUri = null) {
  if (!session || session.state !== SIP.SessionState.Established) {
    alert("No active call to transfer.");
    return;
  }
  if (blindTransfer) {
    if (!targetUri) {
      targetUri = prompt("Enter the SIP URI to transfer the call to:");
    }
    if (targetUri) {
      const target = SIP.UserAgent.makeURI(targetUri);
      session.refer(target);
      logger.info(`Transferring call to ${targetUri}`);
    }
  }
  else {
    if (!targetUri) {
      targetUri = prompt("Enter the SIP URI to transfer the call to:");
    }
    if (targetUri) {
      const target = SIP.UserAgent.makeURI(targetUri);
      const replacementSession = new SIP.Inviter(userAgent, target);
      session.refer(replacementSession);
      logger.info(`Transferring call to ${targetUri} with replacement session`);
    }
  }
}

function getStoredLoginDetails() {
  const sipUser = localStorage.getItem('sipUser');
  const sipPass = localStorage.getItem('sipPass');
  const sipServer = localStorage.getItem('sipServer');
  const wssServer = localStorage.getItem('wssServer');

  return { sipUser, sipPass, sipServer, wssServer };
}

function callHistoryHandler(callInfo) {
  // Only add if not already present
  if (storedCalls.some(call => call.number === callInfo.number && call.time === callInfo.time)) {
    logger.info(`Call to ${callInfo.number} already exists in history.`);
    return;
  }
  storedCalls.push(callInfo);
  const direction = callInfo.direction || 'outgoing'; // Default to 'outgoing' if not specified
  localStorage.setItem('callHistory', JSON.stringify(storedCalls));
  renderCallHistoryItem(callInfo, direction);
}

function renderCallHistoryItem(callInfo, direction = 'outgoing') {
  let iconClass = null;
  if (direction == 'outgoing') {
    iconClass = 'bi bi-telephone-outbound-fill';
  } else if (direction == 'incoming') {
    iconClass = 'bi bi-telephone-inbound-fill';
  } else if (direction == 'missed') {
    iconClass = 'bi bi-telephone-x-fill';
  } else if (direction == 'voicemail') {
    iconClass = 'bi bi-voicemail-fill';
  } else {
    iconClass = 'bi bi-telephone-fill';
  }
  const callHistory = document.getElementById('callHistoryList');
  const callItem = document.createElement('li');
  callItem.className = 'list-group-item d-flex justify-content-between align-items-center';

  const callDate = new Date(callInfo.time);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  let timeDisplay;
  if (
    callDate.getFullYear() === now.getFullYear() &&
    callDate.getMonth() === now.getMonth() &&
    callDate.getDate() === now.getDate()
  ) {
    // Today: show only time
    timeDisplay = callDate.toLocaleTimeString();
  } else if (
    callDate.getFullYear() === yesterday.getFullYear() &&
    callDate.getMonth() === yesterday.getMonth() &&
    callDate.getDate() === yesterday.getDate()
  ) {
    // Yesterday: show "Yesterday" and time
    timeDisplay = `Yesterday ${callDate.toLocaleTimeString()}`;
  } else {
    // Not today or yesterday: show date and time
    timeDisplay = `${callDate.toLocaleDateString()} ${callDate.toLocaleTimeString()}`;
  }

  callItem.innerHTML = `
    <span class="callHistoryItem">
      <i class="${iconClass} me-2"></i>
      <a href="${callInfo.number}" class="callLink">${callInfo.number}</a>
    </span>
    <span class="callTime fs-12">${timeDisplay}</span>
  `;
  callHistory.prepend(callItem);
  callItem.querySelector('.callLink').addEventListener('click', (e) => {
    e.preventDefault();
    const sipUri = e.target.getAttribute('href');
    callee.value = sipUri;
    logger.info(`Calling from history: ${sipUri}`);
    makeCall(sipUri);
  });
}

function notifyIncomingCall(invitation) {
  const caller = invitation.remoteIdentity.uri.toString();
  if (Notification.permission === 'granted' && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'INCOMING_CALL',
      from: caller
    });
  } else {
    logger.warn('Notification permission not granted or no service worker controller available.');
  }
}

function showCallControls(showCallActions = true, showCallControls = true) {
  // Hides other UI elements, show call controls based on parameters
  callControls.classList.remove('d-none');
  phoneTabBtn.click();
  if (showCallActions) {
    callActionButtons.classList.add('show');
  }
  if (showCallControls) {
    callControlButtons.classList.add('show');
  }
}

function showTabs() {
  // Hides call controls, shows tabs
  if (!callControls.classList.contains('d-none')) {
    callControls.classList.add('d-none');
    if (callActionButtons.classList.contains('show')) {
      callActionButtons.classList.remove('show');
    }
    if (callControlButtons.classList.contains('show')) {
      callControlButtons.classList.remove('show');
    }
  }
  if (contactListBtn.classList.contains('active')) {
    contactListBtn.classList.remove('active');
  }
  if (!callHistoryBtn.classList.contains('active')) {
    callHistoryBtn.click();
  }
  if (dialerTabBtn.classList.contains('active')) {
    dialerTabBtn.classList.remove('active');
  }
}

function callDurationCounter() {
  if (callCounterInterval) {
    clearInterval(callCounterInterval);
  }
  let duration = 0;
  callCounterInterval = setInterval(() => {
    if (session && session.state === SIP.SessionState.Established) {
      duration++;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      if (durationElement) {
        durationElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      }
    }
  }, 1000);
}

function prefillLoginDetails() {
    const sipUser = getStoredLoginDetails();
    const username = document.getElementById('sipUser');
    if (username) {
      username.value = sipUser.sipUser || '';
    }
    const password = document.getElementById('sipPass');
    if (password) {
      password.value = sipUser.sipPass || '';
    }
    const server = document.getElementById('sipServer');
    if (server) {
      server.value = sipUser.sipServer || '';
    }
    const wssServer = document.getElementById('wssServer');
    if (wssServer) {
      wssServer.value = sipUser.wssServer || '';
    }
}

function loadContacts() {
  // Load contacts from localStorage or an API
  const contacts = JSON.parse(localStorage.getItem('contacts')) || [];
  for (const contact of contacts) {
    renderContact(contact);
  }
}

function storeContact(name, number) {
  const contacts = JSON.parse(localStorage.getItem('contacts')) || [];
  const existingContact = contacts.find(contact => contact.number === number);
  if (existingContact) {
    logger.warn(`Contact with number ${number} already exists.`);
    return;
  }
  const newContact = { name, number };
  contacts.push(newContact);
  localStorage.setItem('contacts', JSON.stringify(contacts));
  renderContact(newContact);
  logger.info(`Contact ${name} (${number}) stored successfully.`);
}

function renderContact(contact) {
  const contactItem = document.createElement('li');
  contactItem.className = 'list-group-item d-flex justify-content-between align-items-center';
  contactItem.innerHTML = `
    <span class="contactName">${contact.name}</span>
    <span class="contactNumber">${contact.number}</span>
    <button class="btn btn-primary btn-sm callContactBtn">Call</button>
  `;
  contactsList.appendChild(contactItem);
  const callButton = contactItem.querySelector('.callContactBtn');
  callButton.addEventListener('click', () => {
    makeCall(contact.number);
  });
}

function toggleHold() {
  onHold = !onHold;
  const sessionDescriptionHandlerOptions = { hold: onHold };
  const options = {
    requestDelegate: {
      onAccept: () => {
        logger.debug(`Call ${onHold ? 'held' : 'unheld'} successfully.`);
        onHold = onHold ? true : false; // Update hold state
      },
      onReject: (response) => {
        logger.error(`Failed to ${onHold ? 'hold' : 'unhold'} call:`, response);
      }
    }
  };
  session.sessionDescriptionHandlerOptionsReInvite = sessionDescriptionHandlerOptions;
  session.invite(options);
}

function toggleMute() {
    // Mute local audio
    if (!session || !session.sessionDescriptionHandler) {
      logger.warn('No active session or session description handler to mute.');
      return;
    }
    isMuted = !isMuted; // Toggle mute state
    const pc = session.sessionDescriptionHandler.peerConnection;
    logger.debug(`Muting local audio: ${isMuted}`);
    if (isMuted) {
      pc.getLocalStreams().forEach(stream => {
        stream.getAudioTracks().forEach(track => {
          logger.debug(`Disabling track: ${track.label}`);
          track.enabled = false;
        });
      });
    } else {
      // Unmute local audio
      pc.getLocalStreams().forEach(stream => {
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      });
    }
}

function init() {
  const sipUser = getStoredLoginDetails()

  if (!sipUser || !sipUser.sipUser || !sipUser.sipPass || !sipUser.sipServer || !sipUser.wssServer) {
    logger.error('No SIP user details found. Please log in.');
    prefillLoginDetails();
    loginModal.show();
    return;
  }

  const uri = SIP.UserAgent.makeURI(`sip:${sipUser.sipUser}@${sipUser.sipServer}`);

  accountName.textContent = uri || 'Not logged in';
  
  const userAgentOptions = {
    authorizationPassword: sipUser.sipPass,
    uri,
    delegate: {
      onInvite
    },
    transportOptions: {
      server: sipUser.wssServer
    },
    logLevel: sipLogLevel
  };
  userAgent = new SIP.UserAgent(userAgentOptions);

  remoteStream = new MediaStream();

  userAgent.stateChange.addListener((state) => {
    logger.info(`UserAgent state changed to ${state}`);
    switch (state) {
      case SIP.UserAgentState.Started:
        logger.info('UserAgent started successfully');
        break;
      case SIP.UserAgentState.Stopping:
        logger.info('UserAgent is stopping');
        updateStatusLed('disconnected');
        cleanupMedia();
        break;
      case SIP.UserAgentState.Stopped:
        logger.info('UserAgent stopped');
        updateStatusLed('disconnected');
        cleanupMedia();
        break;
      case SIP.UserAgentState.Failed:
        logger.error('UserAgent failed to start:', userAgent.error);
        updateStatusLed('disconnected');
        cleanupMedia();
        break;
    }
  });

  userAgent.start().then(() => {
    const registerer = new SIP.Registerer(userAgent);
  
    // Listen for registration state changes
    registerer.stateChange.addListener((state) => {
      logger.info(`Registerer state changed to ${state}`);
      if (state === SIP.RegistererState.Unregistered) {
        if (!loggingOut) {
          alert('Registration failed. Please check your SIP credentials.');
        }
        // Optionally, show login modal again or clear credentials
        updateStatusLed('disconnected');
        prefillLoginDetails();
        loginModal.show();
      } else if (state === SIP.RegistererState.Registered) {
        logger.info('Successfully registered with SIP server');
        updateStatusLed('connected');
      }
    });
  
    // Listen for registration failures (e.g., 401/407)
    registerer.delegate = {
      onReject: (response) => {
        logger.error('Registration failed:', response);
        if (response && (response.message.statusCode === 401 || response.message.statusCode === 407)) {
          alert('Authentication failed: Invalid SIP username or password.');
          loginModal.show();
        }
      }
    };
  
    logger.debug('SIP UserAgent started');
    registerer.register();
  }).catch(error => {
    logger.error('Failed to start SIP UserAgent:', error);
    alert('Failed to start SIP UserAgent. Please check your network and SIP settings.');
    loginModal.show();
  });


}

// On page load, render all stored calls (but don't add them again)
document.addEventListener('DOMContentLoaded', () => {
  logger.debug('Document loaded, initializing SIP UserAgent');
  registerServiceWorker();
  checkPermissions();

  notificationTickler.addEventListener('click', () => {
    setNotificationPermission();
  });
  sipLoginButton.addEventListener('click', () => {
    const sipUser = document.getElementById('sipUser').value.trim();
    const sipPass = document.getElementById('sipPass').value.trim();
    const sipServer = document.getElementById('sipServer').value.trim();
    const wssServer = document.getElementById('wssServer').value.trim();

    if (!sipUser || !sipPass || !sipServer || !wssServer) {
      alert('Please fill in all SIP login details.');
      return;
    }

    localStorage.setItem('sipUser', sipUser);
    localStorage.setItem('sipPass', sipPass);
    localStorage.setItem('sipServer', sipServer);
    localStorage.setItem('wssServer', wssServer);
    loginModal.hide();
    init();
  });
    dtmfButtons.forEach(button => {
    button.addEventListener('click', () => {
      let signal = button.textContent.trim();
      // if (signal === '*') {
      //   playAudio('static/wav/dtmf/dtmfstar.wav'); // Play DTMF sound for '*'
      // } else if (signal === '#') {
      //   playAudio('static/wav/dtmf/dtmfhash.wav'); // Play DTMF sound for '#'
      // } else {
      //   playAudio(`static/wav/dtmf/dtmf${signal}.wav`); // Play DTMF sound for digits
      // }
      logger.debug(`Sending DTMF signal: ${signal}`);
      if (session && session.state === SIP.SessionState.Established) {
        if (signal === '*') {
          playAudio('static/wav/dtmf/dtmfstar.wav'); // Play DTMF sound for '*'
        } else if (signal === '#') {
          playAudio('static/wav/dtmf/dtmfhash.wav'); // Play DTMF sound for '#'
        } else {
          playAudio(`static/wav/dtmf/dtmf${signal}.wav`); // Play DTMF sound for digits
        }
        sendDTMF(signal);
      } else {
        const callee = document.getElementById('callee')
        logger.debug(`No active call. Attempting to call ${callee} to send DTMF.`);
        callee.value += signal; // Append DTMF to callee input
      }
    });
  });

  callButton.addEventListener('click', () => {
      let callee = checkforPhoneNumber();
      logger.info(`Attempting call to ${callee}`)
      makeCall(callee);
  });


  dialerBtn.addEventListener('click', () => {
    dtmfButtonsContainer.classList.toggle('show');
    callHistoryContainer.classList.toggle('show');
  });

  answerButton.addEventListener('click', () => {
    if (session && session instanceof SIP.Invitation) {
      answerCurrentCall();
      updateStatusLed('in-call');
      callerIdElement.textContent = session.remoteIdentity.displayName || session.remoteIdentity.uri.toString();
      callControlButtons.classList.add('show');
      callActionButtons.classList.remove('show');
    } else {
      logger.warn('No active incoming call to answer.');
    }
  });

  declineButton.addEventListener('click', () => {
    if (session && session instanceof SIP.Invitation) {
      playAudio('static/wav/unique_ringtone.wav', true, true); // Stop ringtone
      updateStatusLed('connected');
      const callInfo = {
        number: session.remoteIdentity.uri.toString(),
        time: Date.now(),
        direction: 'missed' // Indicate this is a missed call
      };
      callHistoryHandler(callInfo); // Log the missed call in history
      session.reject();
      showTabs(); // Show tabs after decline
    } else {
      logger.warn('No active incoming call to decline.');
    }
  });

  hangupButton.addEventListener('click', () => {
    logger.info('Hanging up call');
    endCall();
    updateStatusLed('connected');
    if (callButton.hasAttribute('disabled')) {
      callButton.removeAttribute('disabled'); // Re-enable call button after hangup
    }
    showTabs(); // Show tabs after hangup
  });

  holdButton.addEventListener('click', () => {
    toggleHold();
  });

  muteButton.addEventListener('click', () => {
    toggleMute();
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    playAudio('static/wav/dialtone.wav'); // Play dial tone on load
  });

  statusLed.addEventListener('click', () => {
    logger.debug('Status LED clicked, toggling account manager');
    if (accountManager.classList.contains('show')) {
      accountManager.classList.remove('show');
    }
    else {
      accountManager.classList.add('show');
    }
  });

  logoutButton.addEventListener('click', () => {
    logger.info('Logging out from SIP server');
    if (userAgent) {
      loggingOut = true; // Set flag to prevent multiple logout attempts
      userAgent.stop().then(() => {
        logger.info('UserAgent stopped successfully');
        updateStatusLed('disconnected');
        session = null; // Clear session on logout
        loggingOut = false; // Reset flag
      }).catch(error => {
        logger.error('Failed to stop UserAgent:', error);
        loggingOut = false; // Reset flag on error
      });
    } else {
      logger.warn('No UserAgent instance to stop.');
    }
  });

  init();
  loadContacts();
  const callHistoryList = document.getElementById('callHistoryList');
  callHistoryList.innerHTML = ''; // Clear any existing items
  storedCalls.forEach(call => {
    renderCallHistoryItem(call);
  });
  firstLoad = false;
  logger.debug(`Loading SIP UserAgent with host: ${userAgent.configuration.uri.host}`);
  setInterval(() => {
    if (userAgent && userAgent.state === SIP.UserAgentState.Started && session) {
      // logger.debug(`Current session ID: ${session._id}`);
      // logger.debug(`Current session state: ${session.state}`);
      // logger.debug(`Remote Identity: ${session.remoteIdentity.uri.toString()}`);
      // logger.debug(`Remote Display Name: ${session.remoteIdentity.displayName || 'N/A'}`);
      if (remoteStream) {
        for (const track of remoteStream.getTracks()) {
          // logger.debug(`Remote track: ${track.kind} - ${track.label}`);
          logger.debug(`Track stats:`, `Minimum Latency: ${track.stats.minimumLatency}, Latency: ${track.stats.latency}, Maximum Latency: ${track.stats.maximumLatency}, Average Latency: ${track.stats.averageLatency}`);
          if (!callNetStats.classList.contains('d-none')) {
            callNetStats.innerHTML = `
              <div class="row">
                <div class="col-3">Min:</div>
                <div class="col-3">Average:</div>
                <div class="col-3">Latency:</div>
                <div class="col-3">Max:</div>
              </div>
              <div class="row">
                <div class="col-3">${track.stats.minimumLatency}</div>
                <div class="col-3">${track.stats.averageLatency}</div>
                <div class="col-3">${track.stats.latency}</div>
                <div class="col-3">${track.stats.maximumLatency}</div>
              </div>
              `;
          }
        }
      }
    }
  }, 1000); // Check every 1 second

});