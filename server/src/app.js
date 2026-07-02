/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { spawn } from 'child_process';
import { createJobsRouter } from './routes/jobs.js';
import { createRunsRouter } from './routes/runs.js';
import { errorHandler } from './middleware/errorHandler.js';
import { gatewayTokenMiddleware } from './middleware/gatewayToken.js';
import { eventBus } from './services/eventBus.js';
import * as redis from './services/redis.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

/**
 * Execute a shell command and return the result.
 * @param {string} command - Shell command to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{ok: boolean, stdout?: string, stderr?: string, exitCode?: number, json?: unknown, message?: string}>}
 */
function executeShellCommand(command, timeout = 30000) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn('/bin/sh', ['-c', command], {
      timeout,
      maxBuffer: 512 * 1024,
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);

      if (killed) {
        resolve({ ok: false, message: `Command timed out after ${timeout}ms`, stdout, stderr });
        return;
      }

      // Try to parse stdout as JSON
      let json = null;
      const trimmed = stdout.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          json = JSON.parse(trimmed);
        } catch {
          // Not valid JSON, keep as string
        }
      }

      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        json,
        message: exitCode === 0 ? 'Command executed successfully' : `Exit code: ${exitCode}`,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, message: err.message });
    });
  });
}

export function createApp(scheduler) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, secured: Boolean(process.env.GATEWAY_TOKEN) });
  });

  app.get('/api/version', (_req, res) => {
    res.json({ version: pkg.version });
  });

  app.use('/api', gatewayTokenMiddleware);

  app.use('/api/jobs', createJobsRouter(scheduler));
  app.use('/api/runs', createRunsRouter());

  app.get('/api/redis/test', async (_req, res) => {
    const result = await redis.testConnection();
    res.json(result);
  });

  app.post('/api/redis/set', async (req, res) => {
    const { key, value, ttl } = req.body;
    if (!key) {
      return res.status(400).json({ ok: false, message: 'Key is required' });
    }
    const result = await redis.setValue(key, value, ttl);
    res.json(result);
  });

  app.get('/api/redis/get/:key', async (req, res) => {
    const result = await redis.getValue(req.params.key);
    res.json(result);
  });

  app.post('/api/redis/push', async (req, res) => {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ ok: false, message: 'Key is required' });
    }
    const result = await redis.pushToList(key, value);
    res.json(result);
  });

  app.post('/api/redis/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ ok: false, message: 'Command is required' });
    }
    const result = await redis.executeCommand(command);
    res.json(result);
  });

  app.post('/api/shell/exec', async (req, res) => {
    const { command, timeout = 30000 } = req.body;
    if (!command) {
      return res.status(400).json({ ok: false, message: 'Command is required' });
    }

    try {
      const result = await executeShellCommand(command, timeout);
      res.json(result);
    } catch (error) {
      res.json({ ok: false, message: error.message });
    }
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    function send(eventName, data) {
      if (!res.writableEnded) {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    }

    const onStarted = (data) => send('run:started', data);
    const onFinished = (data) => send('run:finished', data);

    eventBus.on('run:started', onStarted);
    eventBus.on('run:finished', onFinished);

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      eventBus.off('run:started', onStarted);
      eventBus.off('run:finished', onFinished);
    }

    req.on('close', cleanup);
    if (res.socket) {
      res.socket.on('end', cleanup);
      res.socket.on('close', cleanup);
    }
  });

  app.get('/api/validate-path', (req, res) => {
    const filePath = req.query.path || '';
    if (!filePath.trim()) return res.json({ exists: false, isFile: false, executable: false });
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const stat = fs.statSync(filePath);
      const isFile = stat.isFile();
      let executable = false;
      if (isFile) {
        try {
          fs.accessSync(filePath, fs.constants.X_OK);
          executable = true;
        } catch {
          /* not executable */
        }
      }
      res.json({ exists: true, isFile, executable });
    } catch {
      res.json({ exists: false, isFile: false, executable: false });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use(errorHandler);

  return app;
}
