/**
 * LogMe - A simple logging utility for JavaScript applications.
 *
 * Features:
 * - Supports log levels: "debug", "info", "warn", "error"
 * - Persists logs in localStorage, rotating daily
 * - Methods to download logs (JSON or plain text) and clear logs
 *
 * Usage:
 *   import { logMe } from './logme.js';
 *   const logger = new logMe("myApp", "debug");
 *   logger.info("This is an info message");
 *
 * Notes:
 * - Logs are stored in localStorage in plaintext. Do not log sensitive data.
 * - If log level is "debug", utility methods are attached to the window for convenience.
 * - For production, prefer using class methods directly.
 */
export class logMe {
    /**
     * Create a new logger instance.
     * @param {string} logName - Name for the log (used as storage key prefix).
     * @param {string} logLevel - Minimum log level ("debug", "info", "warn", "error").
     */
    constructor(logName, logLevel) {
        this.logLevel = logLevel || "info";
        this.today = new Date();
        this.date = `${this.today.getFullYear()}-${String(this.today.getMonth() + 1).padStart(2, '0')}-${String(this.today.getDate()).padStart(2, '0')}`;
        this.logName = logName || "logMe";
        this.localStorage = true;
        this.storageKey = `${this.logName}_${this.date}_logs`;
        if (!window.localStorage) {
            console.warn("Local storage is not available. Logging will not persist across sessions.");
            this.localStorage = false;
        }
        if (this.logLevel === "debug") {
            console.debug(`LogMe initialized with log name: ${this.logName} and log level: ${this.logLevel}`);
            window.downloadLogs = this.downloadLogs.bind(this);
            window.clearLogs = this.clearLogs.bind(this);
            window.getLogs = this.getLogs.bind(this);
            window.setLogLevel = this.setLogLevel.bind(this);
        }
    }

    /**
     * Get the last stored date for log rotation.
     * @returns {string|null}
     */
    getLastStoredDate() {
        if (this.localStorage) {
            const storedDate = localStorage.getItem(`${this.logName}_date`);
            if (storedDate) return storedDate;
        }
        return null;
    }

    /**
     * Set the last stored date for log rotation.
     */
    setLastStoredDate() {
        if (this.localStorage) {
            localStorage.setItem(`${this.logName}_date`, this.date);
        }
    }

    /**
     * Initialize the logger, rotating logs if the date has changed.
     */
    init() {
        if (this.localStorage) {
            const lastStoredDate = this.getLastStoredDate();
            if (lastStoredDate && lastStoredDate !== this.date) {
                localStorage.setItem(this.storageKey, JSON.stringify([]));
                console.log(`LogMe: New day detected. Resetting logs for ${this.date}.`);
            } else if (!lastStoredDate) {
                localStorage.setItem(this.storageKey, JSON.stringify([]));
                console.log(`LogMe: First time initialization for ${this.date}.`);
            }
            this.setLastStoredDate();
        }
        console.log(`LogMe initialized with log level: ${this.logLevel}`);
    }

    /**
     * Set the minimum log level.
     * @param {string} level - "debug", "info", "warn", or "error"
     */
    setLogLevel(level) {
        this.logLevel = level;
        console.log(`Log level set to: ${this.logLevel}`);
    }

    /**
     * Internal: Get caller location from stack trace.
     * @returns {string}
     */
    getCallerLocation() {
        const err = new Error();
        if (!err.stack) return '';
        const stackLines = err.stack.split('\n');
        // Find the first stack line that does NOT reference logMe
        for (let i = 2; i < stackLines.length; i++) {
            if (!/logMe\./.test(stackLines[i]) && !/logme\.js/.test(stackLines[i])) {
                const caller = stackLines[i].trim();
                // Extract the file name and line number
                // Example: at myFunction (http://localhost:8000/static/js/app.js:123:45)
                const match = caller.match(/at (.+?) \((.+\/)?([^\/]+):(\d+):\d+\)/);
                if (match) {
                    // match[3] = filename, match[4] = line number
                    return `${match[3]}:${match[4]}`;
                }
                // Fallback if no match found
                // Try to match: at http://localhost:8000/static/js/app.js:123:45
                const altMatch = caller.match(/at (.+\/)?([^\/]+):(\d+):\d+/);
                if (altMatch) {
                    // altMatch[2] = filename, altMatch[3] = line number
                    return `${altMatch[2]}:${altMatch[3]}`;
                }
                return caller.replace(/at /, '').trim(); // Just return the line as is
            }
        }
        // Fallback to the last line if nothing found
        return stackLines[stackLines.length - 1].trim();
    }
    
    /**
     * Determine if a message should be logged at the given level.
     * @param {string} level
     * @returns {boolean}
     */
    shouldLog(level) {
        const levels = ["debug", "info", "warn", "error"];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    /**
     * Write a log entry.
     * @param {string} message
     * @param {string} [level=this.logLevel]
     */
    writeLog(message, level = this.logLevel) {
        const location = this.getCallerLocation();
        if (this.localStorage && this.shouldLog(level)) {
            const logs = JSON.parse(localStorage.getItem(this.storageKey)) || [];
            logs.push({ date: this.date, time: new Date().toLocaleTimeString(), level, message, location });
            localStorage.setItem(this.storageKey, JSON.stringify(logs));
        }
        this.log(`${message} (${location})`, level);
    }

    /**
     * Output a log message to the console.
     * @param {string} message
     * @param {string} [level=this.logLevel]
     */
    log(message, level = this.logLevel) {
        if (this.shouldLog(level)) {
            if (level === "debug") {
                console.debug(message);
            } else if (level === "info") {
                console.info(message);
            } else if (level === "warn") {
                console.warn(message);
            } else if (level === "error") {
                console.error(message);
            }
        }
    }

    /**
     * Log a debug message.
     * @param {string} msg
     */
    debug(msg) { this.writeLog(msg, "debug"); }

    /**
     * Log an info message.
     * @param {string} msg
     */
    info(msg) { this.writeLog(msg, "info"); }

    /**
     * Log a warning message.
     * @param {string} msg
     */
    warn(msg) { this.writeLog(msg, "warn"); }

    /**
     * Log an error message.
     * @param {string} msg
     */
    error(msg) { this.writeLog(msg, "error"); }

    /**
     * Retrieve all logs for the current day.
     * @returns {Array}
     */
    getLogs() {
        if (this.localStorage) {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        }
        return [];
    }

    /**
     * Clear all logs for the current day.
     */
    clearLogs() {
        if (this.localStorage) {
            localStorage.removeItem(this.storageKey);
            console.log(`LogMe: Logs cleared for ${this.date}.`);
        }
    }

    /**
     * Download logs as a JSON or plain text file.
     * @param {boolean} [text=false] - If true, download as .log (plain text), else as .json
     */
    downloadLogs(text = false) {
        if (this.localStorage) {
            const logs = this.getLogs();
            let blob = null;
            let fileName = `${this.logName}_logs_${this.date}`;
            if (logs.length === 0) {
                console.warn("No logs available to download.");
                return;
            }
            if (text) {
                blob = new Blob([logs.map(log => `${log.date} ${log.time} [${log.level}] ${log.message}`).join('\n')], { type: 'text/plain' });
                fileName += '.log';
            } else {
                blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
                fileName += '.json';
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
}