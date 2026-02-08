# Block Conquest - Real-Time Multiplayer Territory Game

A real-time, multiplayer block-claiming web application where multiple users compete to capture territory on a shared grid. Built with **Spring Boot** (Java) on the backend and **React** on the frontend, connected via **STOMP WebSockets** for instant live updates.

---

## Live Demo

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8099`

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack & Why](#tech-stack--why)
4. [Real-Time Implementation](#real-time-implementation-deep-dive)
5. [Backend Design](#backend-design)
6. [Frontend Design](#frontend-design)
7. [Database Design](#database-design)
8. [How I Handled Concurrency & Conflicts](#how-i-handled-concurrency--conflicts)
9. [API Endpoints](#api-endpoints)
10. [WebSocket Message Flow](#websocket-message-flow)
11. [Folder Structure](#folder-structure)
12. [How to Run](#how-to-run)
13. [Trade-offs & Decisions](#trade-offs--decisions)
14. [What I Would Add With More Time](#what-i-would-add-with-more-time)

---

## How It Works

1. User opens the app and enters their name on the **Join Screen**
2. Backend assigns the user a **unique color** via `/api/users/register`
3. The full 10x10 grid (100 blocks) is fetched from `/api/blocks`
4. A **STOMP WebSocket** connection is established at `ws://localhost:8099/ws`
5. User clicks any block to **claim it** — the claim is sent via WebSocket to `/app/claim`
6. Backend persists the claim in the database and **broadcasts** the update to `/topic/updates`
7. **All connected clients** instantly receive the update and re-render that single block
8. A 30-second round timer runs; when it ends, the board resets automatically

---

## Architecture Overview

```
┌──────────────────┐         WebSocket (STOMP)        ┌──────────────────┐
│                  │  ◄──────────────────────────────► │                  │
│   React Frontend │         /app/claim (send)         │  Spring Boot     │
│   (Port 3000)    │         /topic/updates (receive)  │  Backend         │
│                  │                                   │  (Port 8099)     │
│  - Join Screen   │         REST API (HTTP)           │                  │
│  - Game Grid     │  ◄──────────────────────────────► │  - Controllers   │
│  - Leaderboard   │         GET /api/blocks           │  - WebSocket     │
│  - Stats Panel   │         POST /api/users/register  │  - JPA/H2 DB    │
│  - Timer         │         POST /api/blocks/reset    │  - STOMP Broker  │
└──────────────────┘                                   └──────────────────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │   H2 Database │
                                                       │  (In-Memory)  │
                                                       └──────────────┘
```

---

## Tech Stack & Why

| Layer        | Technology               | Why I Chose It                                                                                     |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------- |
| **Frontend** | React 19                 | Component-based UI, efficient re-renders with virtual DOM, great for dynamic real-time interfaces   |
| **Backend**  | Spring Boot 3.2 (Java)   | Robust WebSocket support via STOMP, built-in message broker, mature ecosystem for production apps   |
| **Real-time**| STOMP over WebSocket     | Protocol-level pub/sub messaging, automatic topic routing, reconnect support, cleaner than raw WS   |
| **Database** | H2 (in-memory)           | Zero setup, perfect for demos. Easily swappable to MySQL/PostgreSQL for production                  |
| **ORM**      | Spring Data JPA/Hibernate| Simplifies database operations, repository pattern reduces boilerplate                              |
| **HTTP**     | Axios                    | Promise-based, cleaner syntax than fetch, automatic JSON parsing, request/response interceptors     |
| **WS Client**| @stomp/stompjs           | Full STOMP protocol support, auto-reconnect, works natively with Spring's WebSocket message broker  |

---

## Real-Time Implementation (Deep Dive)

This is the core of the application. Here's exactly how real-time updates work:

### Why STOMP over Raw WebSocket?

Raw WebSocket gives you a bidirectional pipe, but you have to build your own message routing, serialization, and pub/sub logic. **STOMP** (Simple Text Oriented Messaging Protocol) gives us:

- **Topic-based routing**: Clients subscribe to `/topic/updates` — Spring routes messages automatically
- **Destination mapping**: `@MessageMapping("/claim")` maps incoming messages like REST controllers do for HTTP
- **Built-in broadcast**: `@SendTo("/topic/updates")` broadcasts to ALL subscribers with zero manual code
- **Protocol-level reconnection**: The STOMP client handles reconnects transparently

### The WebSocket Flow (Step by Step)

```
User A clicks block        User B is watching
    │                           │
    ▼                           │
[STOMP SEND]                    │
destination: /app/claim         │
body: {id:5, owner:"Alice",     │
       color:"#6C63FF"}         │
    │                           │
    ▼                           │
┌─────────────────────┐         │
│ WebSocketController │         │
│ @MessageMapping     │         │
│   ("/claim")        │         │
│                     │         │
│ 1. Find block by ID │         │
│ 2. Update owner     │         │
│ 3. Save to DB       │         │
│ 4. Return block     │         │
│                     │         │
│ @SendTo             │         │
│ ("/topic/updates")  │         │
└─────────┬───────────┘         │
          │                     │
          ▼                     ▼
   ┌─────────────────────────────────┐
   │   STOMP Simple Message Broker   │
   │   Topic: /topic/updates         │
   │                                 │
   │   Broadcasts to ALL subscribers │
   └─────────┬──────────┬───────────┘
             │          │
             ▼          ▼
         User A      User B
         sees it     sees it
         instantly   instantly
```

### Backend WebSocket Config

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");          // Broker listens on /topic/*
        config.setApplicationDestinationPrefixes("/app"); // Client sends to /app/*
    }

    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")                   // WebSocket endpoint
                .setAllowedOrigins("http://localhost:3000"); // CORS for frontend
    }
}
```

### Frontend WebSocket Connection

```javascript
const client = new Client({
    brokerURL: "ws://localhost:8099/ws",
    reconnectDelay: 5000,              // Auto-reconnect every 5s if disconnected
    onConnect: () => {
        client.subscribe("/topic/updates", (msg) => {
            const updatedBlock = JSON.parse(msg.body);
            // Update ONLY the changed block (not entire grid)
            setBlocks(prev => prev.map(b =>
                b.id === updatedBlock.id ? updatedBlock : b
            ));
        });
    },
});
client.activate();
```

**Key optimization**: When a block update arrives, I don't re-fetch the entire grid. I update **only the single changed block** in the React state array using `.map()`. This means:
- Zero extra HTTP requests
- O(n) state update (single array pass)
- React only re-renders the one changed block component (virtual DOM diffing)

---

## Backend Design

### Model: Block

```java
@Entity
@Table(name = "blocks")
public class Block {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private int rowNum;      // Grid row (0-9)
    private int colNum;      // Grid column (0-9)
    private String owner;    // Username of the owner (null = unclaimed)
    private String color;    // Hex color of the owner
}
```

### Controllers

| Controller            | Purpose                        | Endpoints                           |
| --------------------- | ------------------------------ | ----------------------------------- |
| `BlockController`     | REST API for blocks            | `GET /api/blocks`, `POST /api/blocks/reset`, `GET /api/blocks/round-time` |
| `UserController`      | User registration              | `POST /api/users/register`          |
| `WebSocketController` | Real-time block claiming       | STOMP: `/app/claim` -> `/topic/updates` |

### Data Initializer

On startup, `DataInitializer` seeds 100 blocks (10x10 grid) into the H2 database if empty. This replaces the MySQL stored procedure.

---

## Frontend Design

### Component Architecture

```
App.js (Single Component — clean, no prop drilling)
│
├── JOIN SCREEN (screen === "join")
│   ├── Animated Background Grid (150 pulsing cells)
│   ├── Floating Blocks Animation (18 drifting blocks)
│   ├── Logo (3x3 animated color grid)
│   ├── Name Input + Join Button
│   └── Feature Badges
│
└── GAME SCREEN (screen === "game")
    ├── Header
    │   ├── Title + Live Connection Indicator
    │   ├── Round Timer (with progress bar)
    │   └── User Avatar Badge
    ├── Left Sidebar
    │   ├── Stats Panel (Total / Claimed / Free / Yours)
    │   ├── Territory Progress Bars
    │   ├── How to Play
    │   └── New Round Button
    ├── Center: Game Grid (10x10 dynamic blocks)
    └── Right Sidebar
        ├── Leaderboard (top 10, medals, mini progress bars)
        └── Legend
```

### UI/UX Decisions

- **Dark neon theme**: Reduces eye strain, makes colored blocks pop visually
- **Glassmorphism panels**: Modern look with `backdrop-filter: blur()` and semi-transparent backgrounds
- **300ms claim cooldown**: Prevents spam-clicking, gives visual feedback time
- **Flash animation on claim**: Scale + brightness pulse so you notice changes instantly
- **Hover glow on unclaimed blocks**: Clear affordance — "this is clickable"
- **Star marker on your blocks**: Instantly identify your territory in a sea of colors
- **Responsive design**: Works on desktop (3-column), tablet, and mobile (stacked)
- **Timer urgency**: Turns red and pulses when < 5 seconds remain

---

## Database Design

```sql
CREATE TABLE blocks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    row_num INT,          -- Grid position (0-9)
    col_num INT,          -- Grid position (0-9)
    owner VARCHAR(255),   -- Username (NULL if unclaimed)
    color VARCHAR(255)    -- Hex color string
);
-- 100 rows seeded on startup (10x10 grid)
```

**Why this schema?**
- `row_num` / `col_num` allow the frontend to reconstruct the grid layout dynamically
- `owner` as a string (not FK) keeps it simple — no user table needed for MVP
- `color` stored per-block (not derived from owner) allows future features like color trading

**H2 vs MySQL**: I used H2 in-memory for zero-setup development. Switching to MySQL/PostgreSQL requires only changing `application.properties` — no code changes needed, thanks to JPA abstraction.

---

## How I Handled Concurrency & Conflicts

**Problem**: What if two users click the same block at the same time?

**Solution**: The backend processes claims **sequentially** through Spring's `@MessageMapping`. Since the WebSocket message handler is single-threaded per destination by default:

1. User A's claim arrives first → block is saved with A's info
2. User B's claim arrives next → block is **overwritten** with B's info
3. Both updates are broadcast → everyone sees the final state

This is a **"last write wins"** strategy, which is intentional for the game design — you CAN steal blocks from opponents. This creates competitive gameplay.

**Trade-off**: In a production system with millions of users, I would:
- Use optimistic locking (`@Version` annotation) to detect conflicts
- Add a message queue (Redis/RabbitMQ) for ordered processing
- Shard the grid across multiple servers

---

## API Endpoints

| Method | Endpoint              | Description                  | Response                                  |
| ------ | --------------------- | ---------------------------- | ----------------------------------------- |
| GET    | `/api/blocks`         | Get all 100 blocks           | `[{id, rowNum, colNum, owner, color}]`    |
| POST   | `/api/users/register` | Register new user            | `{id: "User-XXX", color: "#6C63FF"}`      |
| POST   | `/api/blocks/reset`   | Reset all blocks + timer     | `200 OK`                                  |
| GET    | `/api/blocks/round-time` | Get round end timestamp   | `1770562287840` (Unix ms)                 |

### WebSocket

| Direction | Destination       | Payload                              |
| --------- | ----------------- | ------------------------------------ |
| Send      | `/app/claim`      | `{id: 5, owner: "Alice", color: "#6C63FF"}` |
| Receive   | `/topic/updates`  | `{id: 5, rowNum: 0, colNum: 4, owner: "Alice", color: "#6C63FF"}` |

---

## WebSocket Message Flow

```
Browser                    Spring Boot                  All Browsers
  │                            │                            │
  │── CONNECT ws://host/ws ──►│                            │
  │◄── CONNECTED ─────────────│                            │
  │                            │                            │
  │── SUBSCRIBE ──────────────│                            │
  │   /topic/updates          │                            │
  │                            │                            │
  │── SEND ───────────────────│                            │
  │   /app/claim              │                            │
  │   {id:5, owner:"Alice"}   │                            │
  │                           │── Save to DB ──►           │
  │                           │── BROADCAST ──────────────►│
  │◄── MESSAGE ───────────────│   /topic/updates           │
  │   {id:5, owner:"Alice",  │   {id:5, owner:"Alice"...} │
  │    rowNum:0, colNum:4}    │                            │
```

---

## Folder Structure

```
Fungame/
├── README.md
├── Block_game.txt                    # Original MySQL schema
│
├── block-game/                       # Backend (Spring Boot)
│   ├── pom.xml                       # Maven config (Spring Boot 3.2, H2, WebSocket)
│   ├── src/main/java/com/game/block_game/
│   │   ├── BlockGameApplication.java # Entry point
│   │   ├── config/
│   │   │   ├── WebSocketConfig.java  # STOMP endpoint + broker config
│   │   │   └── DataInitializer.java  # Seeds 10x10 grid on startup
│   │   ├── controller/
│   │   │   ├── BlockController.java  # REST: get blocks, reset, timer
│   │   │   ├── UserController.java   # REST: register user
│   │   │   └── WebSocketController.java # STOMP: claim block
│   │   ├── model/
│   │   │   └── Block.java            # JPA entity
│   │   └── repo/
│   │       └── BlockRepository.java  # Spring Data JPA repository
│   └── src/main/resources/
│       └── application.properties    # H2 config, port 8099
│
└── block-game-frontend/              # Frontend (React)
    ├── package.json
    ├── public/
    │   └── index.html                # Google Fonts (Inter), meta tags
    └── src/
        ├── index.js                  # React entry point
        ├── index.css                 # Global dark theme base
        ├── App.js                    # Main game component (all logic)
        └── App.css                   # Complete UI styles (1000+ lines)
```

---

## How to Run

### Prerequisites
- Java 17+
- Node.js 16+

### Start Backend
```bash
cd block-game
bash mvnw spring-boot:run
# Starts on http://localhost:8099
# H2 database auto-created, 100 blocks seeded
```

### Start Frontend
```bash
cd block-game-frontend
npm install
npm start
# Opens on http://localhost:3000
```

### Test Multiplayer
Open `http://localhost:3000` in **multiple browser tabs**. Enter different names. Click blocks and watch them update in real-time across all tabs.

---

## Trade-offs & Decisions

| Decision                         | Trade-off                                   | Why                                                  |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| H2 instead of MySQL              | Data lost on restart                        | Zero setup for demo; swap via config for production   |
| Single App.js component          | Larger file                                 | No prop drilling, simpler state management for MVP    |
| Last-write-wins for conflicts    | No conflict resolution                      | Intentional: stealing blocks IS the gameplay          |
| 300ms client-side cooldown       | Server still accepts rapid clicks           | Good UX feel; server-side rate limiting for production |
| In-memory round timer            | Resets on server restart                    | Simple; use Redis/scheduled tasks for production      |
| STOMP over raw WebSocket         | Slight protocol overhead                    | Built-in routing, pub/sub, and Spring integration     |
| Sort blocks client-side          | O(n log n) on each render                   | `useMemo` caches result; only recomputes when blocks change |
| Single block update (not full grid) | Slightly complex state update logic     | Massive performance win: 1 block vs 100 blocks per update |

---

## What I Would Add With More Time

- **Server-side rate limiting**: Prevent claim spam at the API level
- **Optimistic locking**: `@Version` on Block entity for true conflict detection
- **User sessions**: Track connected users, show online count accurately
- **Larger grid**: 20x20 or 50x50 with zoom/pan (CSS transform + wheel events)
- **Sound effects**: Subtle audio feedback on claim/steal
- **Persistent scoreboard**: Track wins across rounds
- **Deploy**: Dockerize + deploy to AWS/Render (frontend on Vercel)
- **Authentication**: JWT tokens so usernames can't be spoofed
