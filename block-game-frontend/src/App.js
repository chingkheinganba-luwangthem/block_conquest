import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import "./App.css";

const API = "http://localhost:8099/api";

export default function App() {
  const [screen, setScreen] = useState("join");
  const [username, setUsername] = useState("");
  const [userColor, setUserColor] = useState("#6C63FF");
  const [blocks, setBlocks] = useState([]);
  const [cols, setCols] = useState(10);
  const [connected, setConnected] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [roundEnd, setRoundEnd] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [flashId, setFlashId] = useState(null);
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const clientRef = useRef(null);

  // Leaderboard from blocks
  const leaderboard = useMemo(() => {
    const counts = {};
    blocks.forEach((b) => {
      if (b.owner) {
        if (!counts[b.owner])
          counts[b.owner] = { name: b.owner, color: b.color, count: 0 };
        counts[b.owner].count++;
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [blocks]);

  const totalBlocks = blocks.length;
  const claimedBlocks = blocks.filter((b) => b.owner).length;
  const myBlocks = blocks.filter((b) => b.owner === username).length;

  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort((a, b) =>
        a.rowNum !== b.rowNum ? a.rowNum - b.rowNum : a.colNum - b.colNum
      ),
    [blocks]
  );

  // Load blocks from backend
  const loadBlocks = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/blocks`);
      setBlocks(data);
      if (data.length > 0) {
        setCols(Math.max(...data.map((b) => b.colNum)) + 1);
      }
    } catch (e) {
      console.error("Load blocks error:", e);
    }
  }, []);

  // Join game
  const handleJoin = async () => {
    if (!username.trim()) return;
    setError("");
    try {
      const { data } = await axios.post(`${API}/users/register`);
      setUserColor(data.color);
      await loadBlocks();
      const timeRes = await axios.get(`${API}/blocks/round-time`);
      setRoundEnd(timeRes.data);
      connectWs();
      setScreen("game");
    } catch (err) {
      setError(
        "Cannot connect to server. Ensure backend is running on port 8099."
      );
    }
  };

  // WebSocket
  const connectWs = () => {
    const client = new Client({
      brokerURL: "ws://localhost:8099/ws",
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe("/topic/updates", (msg) => {
          const updated = JSON.parse(msg.body);
          setBlocks((prev) =>
            prev.map((b) => (b.id === updated.id ? updated : b))
          );
          setFlashId(updated.id);
          setTimeout(() => setFlashId(null), 700);
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;
  };

  // Claim block
  const claimBlock = (block) => {
    if (cooldown || !clientRef.current?.connected) return;
    if (block.owner === username) return;
    if (timeLeft <= 0) return;

    clientRef.current.publish({
      destination: "/app/claim",
      body: JSON.stringify({ id: block.id, owner: username, color: userColor }),
    });

    setCooldown(true);
    setTimeout(() => setCooldown(false), 300);
  };

  // Round timer + auto-reset
  useEffect(() => {
    if (screen !== "game") return;
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/blocks/round-time`);
        const left = Math.max(0, Math.ceil((data - Date.now()) / 1000));
        setTimeLeft(left);
        if (left === 0 && !showResult) {
          setShowResult(true);
          setTimeout(async () => {
            await axios.post(`${API}/blocks/reset`);
            await loadBlocks();
            const timeRes = await axios.get(`${API}/blocks/round-time`);
            setRoundEnd(timeRes.data);
            setShowResult(false);
          }, 4000);
        }
      } catch (e) { /* ignore */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, showResult, loadBlocks]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (clientRef.current) clientRef.current.deactivate();
    };
  }, []);

  // Reset
  const resetBoard = async () => {
    try {
      await axios.post(`${API}/blocks/reset`);
      await loadBlocks();
      const { data } = await axios.get(`${API}/blocks/round-time`);
      setRoundEnd(data);
    } catch (e) {
      console.error("Reset failed:", e);
    }
  };

  /* ══════════════════════════════════════════════════
     JOIN SCREEN
     ══════════════════════════════════════════════════ */
  if (screen === "join") {
    return (
      <div className="join-screen">
        {/* Animated background grid */}
        <div className="join-bg-grid">
          {Array.from({ length: 150 }, (_, i) => (
            <div
              key={i}
              className="bg-cell"
              style={{
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${3 + Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <div className="join-card">
          {/* Logo */}
          <div className="join-logo">
            <div className="logo-grid">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className={`logo-block lb-${i}`} />
              ))}
            </div>
          </div>

          <h1 className="join-title">Block Conquest</h1>
          <p className="join-subtitle">
            Claim territory. Compete in real-time. Dominate the grid.
          </p>

          <div className="join-form">
            <input
              type="text"
              className="join-input"
              placeholder="Enter your name..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={15}
              autoFocus
            />
            <button
              className="join-btn"
              onClick={handleJoin}
              disabled={!username.trim()}
            >
              <span>Enter Arena</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {error && <p className="join-error">{error}</p>}

          <div className="join-features">
            <div className="feature">
              <span className="feature-icon">&#9889;</span> Real-time Sync
            </div>
            <div className="feature">
              <span className="feature-icon">&#9733;</span> Live Leaderboard
            </div>
            <div className="feature">
              <span className="feature-icon">&#127942;</span> Compete & Win
            </div>
          </div>
        </div>

        {/* Floating blocks */}
        <div className="floating-blocks">
          {Array.from({ length: 18 }, (_, i) => (
            <div
              key={i}
              className={`floating-block fb-${i % 6}`}
              style={{
                left: `${5 + Math.random() * 90}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${10 + Math.random() * 15}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     GAME SCREEN
     ══════════════════════════════════════════════════ */
  return (
    <div className="game-screen">
      {/* Round over overlay */}
      {showResult && (
        <div className="result-overlay">
          <div className="result-card">
            <div className="result-emoji">&#127937;</div>
            <h2>Round Over!</h2>
            {leaderboard.length > 0 && (
              <div className="result-winner">
                <span className="winner-trophy">&#127942;</span>
                <span>Winner: <strong>{leaderboard[0].name}</strong> &mdash; {leaderboard[0].count} blocks</span>
              </div>
            )}
            <p className="result-your-score">
              You captured <strong>{myBlocks}</strong> blocks
            </p>
            <p className="result-loading">New round starting...</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="game-header">
        <div className="header-section header-left">
          <h1 className="game-title">
            <span className="title-block">&#9632;</span> Block Conquest
          </h1>
          <div className={`conn-badge ${connected ? "conn-on" : "conn-off"}`}>
            <span className="conn-dot" />
            {connected ? "Live" : "Reconnecting..."}
          </div>
        </div>

        <div className="header-section header-center">
          <div className={`timer-box ${timeLeft <= 5 ? "timer-urgent" : ""}`}>
            <div className="timer-label">Round ends in</div>
            <div className="timer-value">
              {timeLeft > 0 ? `${timeLeft}s` : "Time's up!"}
            </div>
            <div className="timer-track">
              <div
                className="timer-fill"
                style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="header-section header-right">
          <div className="user-badge">
            <div className="user-avatar" style={{ background: userColor }}>
              {username[0]?.toUpperCase()}
            </div>
            <div className="user-info-text">
              <div className="user-name-display">{username}</div>
              <div className="user-score-display">{myBlocks} captured</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="game-main">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <div className="panel">
            <h3 className="panel-title">
              <span>&#128202;</span> Game Stats
            </h3>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-number">{totalBlocks}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card sc-claimed">
                <div className="stat-number">{claimedBlocks}</div>
                <div className="stat-label">Claimed</div>
              </div>
              <div className="stat-card sc-free">
                <div className="stat-number">{totalBlocks - claimedBlocks}</div>
                <div className="stat-label">Free</div>
              </div>
              <div className="stat-card sc-mine">
                <div className="stat-number">{myBlocks}</div>
                <div className="stat-label">Yours</div>
              </div>
            </div>

            <div className="bar-section">
              <div className="bar-header">
                <span>Territory Control</span>
                <span>
                  {totalBlocks > 0
                    ? ((claimedBlocks / totalBlocks) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${
                      totalBlocks > 0
                        ? (claimedBlocks / totalBlocks) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="bar-section">
              <div className="bar-header">
                <span>Your Dominance</span>
                <span style={{ color: userColor }}>
                  {totalBlocks > 0
                    ? ((myBlocks / totalBlocks) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill bar-mine"
                  style={{
                    width: `${
                      totalBlocks > 0 ? (myBlocks / totalBlocks) * 100 : 0
                    }%`,
                    background: userColor,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">
              <span>&#128161;</span> How to Play
            </h3>
            <ul className="how-list">
              <li>Click any block to claim it</li>
              <li>Steal opponents' territory</li>
              <li>Own the most blocks to win</li>
              <li>All updates are real-time!</li>
            </ul>
          </div>

          <button className="reset-btn" onClick={resetBoard}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            New Round
          </button>
        </aside>

        {/* GRID */}
        <section className="grid-section">
          <div
            className="game-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {sortedBlocks.map((block) => {
              const isMine = block.owner === username;
              const isClaimed = !!block.owner;
              const isFlash = flashId === block.id;

              return (
                <div
                  key={block.id}
                  className={[
                    "block",
                    isClaimed ? "claimed" : "unclaimed",
                    isMine ? "mine" : "",
                    isFlash ? "flash" : "",
                    cooldown ? "on-cooldown" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    isClaimed
                      ? {
                          backgroundColor: block.color,
                          boxShadow: `0 0 10px ${block.color}50, inset 0 0 8px ${block.color}30`,
                        }
                      : {}
                  }
                  onClick={() => claimBlock(block)}
                  title={
                    block.owner
                      ? `Owned by ${block.owner}`
                      : "Click to claim!"
                  }
                >
                  {isMine && <span className="mine-star">&#9733;</span>}
                  {isFlash && <span className="claim-ripple" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar sidebar-right">
          <div className="panel leaderboard-panel">
            <h3 className="panel-title">
              <span>&#127942;</span> Leaderboard
            </h3>
            {leaderboard.length === 0 ? (
              <div className="empty-lb">
                <div className="empty-lb-icon">&#9876;</div>
                <p>No claims yet. Be the first!</p>
              </div>
            ) : (
              <div className="lb-list">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div
                    key={entry.name}
                    className={`lb-entry ${
                      entry.name === username ? "lb-me" : ""
                    } ${i < 3 ? `lb-top` : ""}`}
                  >
                    <div className="lb-rank">
                      {i === 0
                        ? "\u{1F947}"
                        : i === 1
                        ? "\u{1F948}"
                        : i === 2
                        ? "\u{1F949}"
                        : `#${i + 1}`}
                    </div>
                    <div
                      className="lb-dot"
                      style={{ background: entry.color }}
                    />
                    <div className="lb-name">{entry.name}</div>
                    <div className="lb-count">{entry.count}</div>
                    <div className="lb-minibar">
                      <div
                        className="lb-minibar-fill"
                        style={{
                          width: `${
                            totalBlocks > 0
                              ? (entry.count / totalBlocks) * 100
                              : 0
                          }%`,
                          background: entry.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="panel-title">
              <span>&#127912;</span> Legend
            </h3>
            <div className="legend-list">
              <div className="legend-item">
                <div className="legend-swatch unclaimed-swatch" />
                <span>Unclaimed</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-swatch"
                  style={{
                    background: userColor,
                    boxShadow: `0 0 6px ${userColor}`,
                  }}
                />
                <span>Your blocks</span>
              </div>
              <div className="legend-item">
                <div className="legend-swatch enemy-swatch" />
                <span>Opponents</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
