/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import Redis from 'ioredis';
import { logger } from '../logger.js';

/** @type {Redis|null} */
let client = null;

/**
 * Get or create a Redis client instance.
 * @returns {Redis|null} Redis client or null if not configured
 */
export function getClient() {
  if (client) return client;

  const url = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;

  // If no Redis config, return null (Redis is optional)
  if (!url && !host) {
    return null;
  }

  try {
    if (url) {
      client = new Redis(url, { lazyConnect: true });
    } else {
      client = new Redis({
        host: host || '127.0.0.1',
        port: parseInt(port || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        lazyConnect: true,
      });
    }

    client.on('error', (err) => {
      logger.error({ error: err }, 'Redis connection error');
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to create Redis client');
    return null;
  }
}

/**
 * Test Redis connection by sending PING.
 * @returns {Promise<{ok: boolean, message: string, latencyMs?: number}>}
 */
export async function testConnection() {
  const redis = getClient();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }

  try {
    const start = Date.now();
    await redis.connect();
    const pong = await redis.ping();
    const latencyMs = Date.now() - start;

    if (pong === 'PONG') {
      return { ok: true, message: 'Connected successfully', latencyMs };
    }
    return { ok: false, message: `Unexpected response: ${pong}` };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

/**
 * Push a value to a Redis key.
 * @param {string} key - Redis key
 * @param {string|object} value - Value to store (objects are JSON-stringified)
 * @param {number} [ttlSeconds] - Optional TTL in seconds
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function setValue(key, value, ttlSeconds) {
  const redis = getClient();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }

  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value;

    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }

    return { ok: true, message: `Set key "${key}" successfully` };
  } catch (error) {
    logger.error({ error, key }, 'Failed to set Redis key');
    return { ok: false, message: error.message };
  }
}

/**
 * Get a value from Redis.
 * @param {string} key - Redis key
 * @returns {Promise<{ok: boolean, value?: string, message?: string}>}
 */
export async function getValue(key) {
  const redis = getClient();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }

  try {
    const value = await redis.get(key);
    return { ok: true, value };
  } catch (error) {
    logger.error({ error, key }, 'Failed to get Redis key');
    return { ok: false, message: error.message };
  }
}

/**
 * Push a value to a Redis list (RPUSH).
 * @param {string} key - Redis list key
 * @param {string|object} value - Value to push (objects are JSON-stringified)
 * @returns {Promise<{ok: boolean, message: string, length?: number}>}
 */
export async function pushToList(key, value) {
  const redis = getClient();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }

  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
    const length = await redis.rpush(key, serialized);
    return { ok: true, message: `Pushed to list "${key}"`, length };
  } catch (error) {
    logger.error({ error, key }, 'Failed to push to Redis list');
    return { ok: false, message: error.message };
  }
}

/**
 * Execute a raw Redis command.
 * @param {string} command - Redis command string (e.g., "GET mykey", "KEYS *")
 * @returns {Promise<{ok: boolean, result?: unknown, message?: string}>}
 */
export async function executeCommand(command) {
  const redis = getClient();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }

  if (!command || !command.trim()) {
    return { ok: false, message: 'Command is required' };
  }

  try {
    // Parse command string into parts
    const parts = parseCommand(command.trim());
    if (parts.length === 0) {
      return { ok: false, message: 'Invalid command' };
    }

    const [cmd, ...args] = parts;
    const result = await redis.call(cmd.toUpperCase(), ...args);

    return { ok: true, result: formatResult(result) };
  } catch (error) {
    logger.error({ error, command }, 'Failed to execute Redis command');
    return { ok: false, message: error.message };
  }
}

/**
 * Parse a command string into parts, respecting quoted strings.
 * @param {string} command - Command string
 * @returns {string[]} Array of command parts
 */
function parseCommand(command) {
  const parts = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        if (current) parts.push(current);
        current = '';
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ') {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Format Redis result for JSON serialization.
 * @param {unknown} result - Redis command result
 * @returns {unknown} Formatted result
 */
function formatResult(result) {
  if (result === null) return null;
  if (Buffer.isBuffer(result)) return result.toString();
  if (Array.isArray(result)) return result.map(formatResult);
  return result;
}

/**
 * Close the Redis connection.
 * @returns {Promise<void>}
 */
export async function close() {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis connection closed');
  }
}
