package com.datachef.utils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * JSON Logger for structured log output
 * Logs are printed to stdout in JSON format for parsing by Node.js server
 */
public class Logger {
    private static final Gson gson = new GsonBuilder().create();

    public enum Level {
        DEBUG("debug"),
        INFO("info"),
        WARN("warn"),
        ERROR("error");

        private final String value;

        Level(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Log a message at the specified level
     */
    public static void log(Level level, String message) {
        Map<String, String> logEntry = new HashMap<>();
        logEntry.put("timestamp", Instant.now().toString());
        logEntry.put("level", level.getValue());
        logEntry.put("message", message);

        String jsonLog = gson.toJson(logEntry);
        System.err.println(jsonLog);
        System.err.flush();
    }

    /**
     * Log info message
     */
    public static void info(String message) {
        log(Level.INFO, message);
    }

    /**
     * Log warn message
     */
    public static void warn(String message) {
        log(Level.WARN, message);
    }

    /**
     * Log error message
     */
    public static void error(String message) {
        log(Level.ERROR, message);
    }

    /**
     * Log error with exception
     */
    public static void error(String message, Throwable throwable) {
        String fullMessage = message + ": " + throwable.getMessage();
        log(Level.ERROR, fullMessage);
    }

    /**
     * Log debug message
     */
    public static void debug(String message) {
        log(Level.DEBUG, message);
    }
}

