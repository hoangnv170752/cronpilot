/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import { useState } from 'react';
import { Dialog } from '../ui/Dialog.jsx';
import { Button } from '../ui/Button.jsx';
import { api } from '../../api/client.js';
import { CheckCircle, XCircle, Loader2, Send, Download, Terminal, Play, Database } from 'lucide-react';

/**
 * Settings dialog component for testing shell commands and Redis operations.
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {() => void} props.onClose - Callback to close the dialog
 */
export function RedisDialog({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('shell'); // 'shell' | 'redis'

  // Shell command state
  const [shellCommand, setShellCommand] = useState('');
  const [shellResult, setShellResult] = useState(null);
  const [shellExecuting, setShellExecuting] = useState(false);
  const [shellHistory, setShellHistory] = useState([]);
  const [shellHistoryIndex, setShellHistoryIndex] = useState(-1);

  // Redis state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [ttl, setTtl] = useState('');
  const [setResult, setSetResult] = useState(null);
  const [setting, setSetting] = useState(false);
  const [getKey, setGetKey] = useState('');
  const [getResult, setGetResult] = useState(null);
  const [getting, setGetting] = useState(false);
  const [redisCommand, setRedisCommand] = useState('');
  const [redisCommandResult, setRedisCommandResult] = useState(null);
  const [redisExecuting, setRedisExecuting] = useState(false);
  const [redisHistory, setRedisHistory] = useState([]);
  const [redisHistoryIndex, setRedisHistoryIndex] = useState(-1);

  // Shell command handlers
  const handleShellExec = async () => {
    if (!shellCommand.trim()) return;
    setShellExecuting(true);
    setShellResult(null);
    try {
      const result = await api.shellExec(shellCommand.trim(), 30000);
      setShellResult(result);
      setShellHistory((prev) => {
        const filtered = prev.filter((c) => c !== shellCommand.trim());
        return [shellCommand.trim(), ...filtered].slice(0, 20);
      });
      setShellHistoryIndex(-1);
    } catch (err) {
      setShellResult({ ok: false, message: err.message });
    } finally {
      setShellExecuting(false);
    }
  };

  const handleShellKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleShellExec();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (shellHistory.length > 0) {
        const newIndex = Math.min(shellHistoryIndex + 1, shellHistory.length - 1);
        setShellHistoryIndex(newIndex);
        setShellCommand(shellHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (shellHistoryIndex > 0) {
        const newIndex = shellHistoryIndex - 1;
        setShellHistoryIndex(newIndex);
        setShellCommand(shellHistory[newIndex]);
      } else if (shellHistoryIndex === 0) {
        setShellHistoryIndex(-1);
        setShellCommand('');
      }
    }
  };

  // Redis handlers
  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    try {
      const result = await api.redisTest();
      setConnectionStatus(result);
    } catch (err) {
      setConnectionStatus({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSet = async () => {
    if (!key.trim()) return;
    setSetting(true);
    setSetResult(null);
    try {
      const result = await api.redisSet(key.trim(), value, ttl ? parseInt(ttl, 10) : undefined);
      setSetResult(result);
    } catch (err) {
      setSetResult({ ok: false, message: err.message });
    } finally {
      setSetting(false);
    }
  };

  const handleGet = async () => {
    if (!getKey.trim()) return;
    setGetting(true);
    setGetResult(null);
    try {
      const result = await api.redisGet(getKey.trim());
      setGetResult(result);
    } catch (err) {
      setGetResult({ ok: false, message: err.message });
    } finally {
      setGetting(false);
    }
  };

  const handleRedisCommand = async () => {
    if (!redisCommand.trim()) return;
    setRedisExecuting(true);
    setRedisCommandResult(null);
    try {
      const result = await api.redisCommand(redisCommand.trim());
      setRedisCommandResult(result);
      setRedisHistory((prev) => {
        const filtered = prev.filter((c) => c !== redisCommand.trim());
        return [redisCommand.trim(), ...filtered].slice(0, 20);
      });
      setRedisHistoryIndex(-1);
    } catch (err) {
      setRedisCommandResult({ ok: false, message: err.message });
    } finally {
      setRedisExecuting(false);
    }
  };

  const handleRedisKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRedisCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (redisHistory.length > 0) {
        const newIndex = Math.min(redisHistoryIndex + 1, redisHistory.length - 1);
        setRedisHistoryIndex(newIndex);
        setRedisCommand(redisHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (redisHistoryIndex > 0) {
        const newIndex = redisHistoryIndex - 1;
        setRedisHistoryIndex(newIndex);
        setRedisCommand(redisHistory[newIndex]);
      } else if (redisHistoryIndex === 0) {
        setRedisHistoryIndex(-1);
        setRedisCommand('');
      }
    }
  };

  /**
   * Format Redis result for display.
   * @param {unknown} result - Result to format
   * @returns {string} Formatted result string
   */
  const formatRedisResult = (result) => {
    if (result === null) return '(nil)';
    if (typeof result === 'string') return result;
    if (typeof result === 'number') return String(result);
    if (Array.isArray(result)) {
      if (result.length === 0) return '(empty array)';
      return result.map((item, i) => `${i + 1}) ${formatRedisResult(item)}`).join('\n');
    }
    return JSON.stringify(result, null, 2);
  };

  const inputCls =
    'w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-[#383838] rounded-lg text-[#efefef] placeholder-[#505050] focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30';
  const labelCls = 'block text-xs font-medium text-[#909090] mb-1.5';
  const sectionCls = 'p-4 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a]';
  const tabCls = (active) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${active ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-[#909090] hover:text-[#efefef] hover:bg-[#2a2a2a]'}`;

  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a]">
          <button className={tabCls(activeTab === 'shell')} onClick={() => setActiveTab('shell')}>
            <Terminal size={16} />
            Shell Command
          </button>
          <button className={tabCls(activeTab === 'redis')} onClick={() => setActiveTab('redis')}>
            <Database size={16} />
            Redis
          </button>
        </div>

        {/* Shell Tab */}
        {activeTab === 'shell' && (
          <div className="space-y-5">
            <div className={sectionCls}>
              <div className="flex items-center gap-2 mb-3">
                <Terminal size={16} className="text-red-400" />
                <h3 className="text-sm font-semibold text-[#efefef]">Execute Command</h3>
              </div>
              <div className="mb-3">
                <textarea
                  className={`${inputCls} font-mono min-h-[80px] resize-y`}
                  placeholder="curl -s https://api.example.com/data&#10;echo 'Hello World'&#10;ls -la /tmp"
                  value={shellCommand}
                  onChange={(e) => setShellCommand(e.target.value)}
                  onKeyDown={handleShellKeyDown}
                />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Play}
                  onClick={handleShellExec}
                  disabled={shellExecuting || !shellCommand.trim()}
                >
                  {shellExecuting ? 'Running...' : 'Run'}
                </Button>
                <p className="text-xs text-[#505050]">Press Enter to execute. Arrow Up/Down for history.</p>
              </div>
              {shellResult && (
                <div
                  className={`rounded-lg text-sm font-mono ${shellResult.ok ? 'bg-[#0d0d0d] border border-[#383838]' : 'bg-rose-500/10 border border-rose-500/30'}`}
                >
                  {/* Status bar */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 border-b ${shellResult.ok ? 'border-[#383838] text-green-400' : 'border-rose-500/30 text-rose-400'}`}
                  >
                    {shellResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    <span className="text-xs">{shellResult.message}</span>
                    {shellResult.exitCode !== undefined && (
                      <span className="ml-auto text-xs opacity-70">Exit: {shellResult.exitCode}</span>
                    )}
                  </div>
                  {/* Output */}
                  <div className="p-3 max-h-[300px] overflow-auto">
                    {shellResult.json ? (
                      <pre className="text-[#efefef] whitespace-pre-wrap break-all">
                        {JSON.stringify(shellResult.json, null, 2)}
                      </pre>
                    ) : shellResult.stdout ? (
                      <pre className="text-[#efefef] whitespace-pre-wrap break-all">{shellResult.stdout}</pre>
                    ) : shellResult.stderr ? (
                      <pre className="text-rose-400 whitespace-pre-wrap break-all">{shellResult.stderr}</pre>
                    ) : (
                      <span className="text-[#505050]">(no output)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Redis Tab */}
        {activeTab === 'redis' && (
          <div className="space-y-5">
            {/* Redis Command Section */}
            <div className={sectionCls}>
              <div className="flex items-center gap-2 mb-3">
                <Terminal size={16} className="text-red-400" />
                <h3 className="text-sm font-semibold text-[#efefef]">Redis Command</h3>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className={`${inputCls} font-mono`}
                  placeholder="PING, GET key, SET key value, KEYS *, ..."
                  value={redisCommand}
                  onChange={(e) => setRedisCommand(e.target.value)}
                  onKeyDown={handleRedisKeyDown}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={Play}
                  onClick={handleRedisCommand}
                  disabled={redisExecuting || !redisCommand.trim()}
                >
                  {redisExecuting ? 'Running...' : 'Run'}
                </Button>
              </div>
              <p className="text-xs text-[#505050] mb-3">Press Enter to execute. Arrow Up/Down for history.</p>
              {redisCommandResult && (
                <div
                  className={`p-3 rounded-lg text-sm font-mono ${redisCommandResult.ok ? 'bg-[#0d0d0d] border border-[#383838]' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}
                >
                  {redisCommandResult.ok ? (
                    <pre className="text-[#efefef] whitespace-pre-wrap break-all">
                      {formatRedisResult(redisCommandResult.result)}
                    </pre>
                  ) : (
                    <span>{redisCommandResult.message}</span>
                  )}
                </div>
              )}
            </div>

            {/* Connection Test Section */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#efefef]">Connection Test</h3>
                <Button variant="secondary" size="sm" onClick={testConnection} disabled={testing}>
                  {testing ? <Loader2 size={14} className="animate-spin" /> : 'Test Connection'}
                </Button>
              </div>
              {connectionStatus && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${connectionStatus.ok ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}
                >
                  {connectionStatus.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{connectionStatus.message}</span>
                  {connectionStatus.latencyMs !== undefined && (
                    <span className="ml-auto text-xs opacity-70">{connectionStatus.latencyMs}ms</span>
                  )}
                </div>
              )}
            </div>

            {/* Set Value Section */}
            <div className={sectionCls}>
              <h3 className="text-sm font-semibold text-[#efefef] mb-3">Set Value</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>Key *</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="my:key"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>TTL (seconds)</label>
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="Optional"
                    value={ttl}
                    onChange={(e) => setTtl(e.target.value)}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className={labelCls}>Value</label>
                <textarea
                  className={`${inputCls} min-h-[60px] resize-y`}
                  placeholder="Value to store (string or JSON)"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button variant="primary" size="sm" icon={Send} onClick={handleSet} disabled={setting || !key.trim()}>
                  {setting ? 'Setting...' : 'Set'}
                </Button>
                {setResult && (
                  <span className={`text-xs ${setResult.ok ? 'text-green-400' : 'text-rose-400'}`}>
                    {setResult.message}
                  </span>
                )}
              </div>
            </div>

            {/* Get Value Section */}
            <div className={sectionCls}>
              <h3 className="text-sm font-semibold text-[#efefef] mb-3">Get Value</h3>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className={labelCls}>Key *</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="my:key"
                    value={getKey}
                    onChange={(e) => setGetKey(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleGet}
                    disabled={getting || !getKey.trim()}
                  >
                    {getting ? 'Getting...' : 'Get'}
                  </Button>
                </div>
              </div>
              {getResult && (
                <div
                  className={`p-3 rounded-lg text-sm ${getResult.ok ? 'bg-[#0d0d0d] border border-[#383838]' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}
                >
                  {getResult.ok ? (
                    <div>
                      <span className="text-[#909090]">Result: </span>
                      <code className="text-[#efefef] break-all">{getResult.value ?? '(null)'}</code>
                    </div>
                  ) : (
                    <span>{getResult.message}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
