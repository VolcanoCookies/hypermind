require('dotenv').config();

const { generateIdentity } = require("./src/core/identity");
const { PeerManager } = require("./src/state/peers");
const { DiagnosticsManager } = require("./src/state/diagnostics");
const { MessageHandler } = require("./src/p2p/messaging");
const { relayMessage } = require("./src/p2p/relay");
const { SwarmManager } = require("./src/p2p/swarm");
const { SSEManager } = require("./src/web/sse");
const { DatabaseManager } = require("./src/state/database");
const { createServer, startServer } = require("./src/web/server");
const { DIAGNOSTICS_INTERVAL, ENABLE_CHAT, ENABLE_MAP } = require("./src/config/constants");

const main = async () => {
  const identity = generateIdentity();
  const peerManager = new PeerManager();
  const diagnostics = new DiagnosticsManager();
  const sseManager = new SSEManager();
  const databaseManager = new DatabaseManager(process.env.MONGO_URL || "mongodb://localhost:27017");
  await databaseManager.connect();

  peerManager.addOrUpdatePeer(identity.id, peerManager.getSeq());

  const broadcastUpdate = () => {
    sseManager.broadcastUpdate({
      count: peerManager.size,
      totalUnique: peerManager.totalUniquePeers,
      direct: swarmManager.getSwarm().connections.size,
      id: identity.id,
      diagnostics: diagnostics.getStats(),
      chatEnabled: ENABLE_CHAT,
      mapEnabled: ENABLE_MAP,
      peers: peerManager.getPeersWithIps()
    });
  };

  const chatCallback = (msg) => {
    sseManager.broadcast(msg);
    databaseManager.addMessage(msg).catch(console.error);
  };

  const chatSystemFn = (msg) => {
    sseManager.broadcast(msg);
  };

  const messageHandler = new MessageHandler(
    peerManager,
    diagnostics,
    (msg, sourceSocket) => relayMessage(msg, sourceSocket, swarmManager.getSwarm(), diagnostics),
    broadcastUpdate,
    chatCallback,
    chatSystemFn
  );

  const swarmManager = new SwarmManager(
    identity,
    peerManager,
    diagnostics,
    messageHandler,
    (msg, sourceSocket) => relayMessage(msg, sourceSocket, swarmManager.getSwarm(), diagnostics),
    broadcastUpdate,
    chatSystemFn
  );

  await swarmManager.start();

  diagnostics.startLogging(
    () => peerManager.size,
    () => swarmManager.getSwarm().connections.size
  );

  setInterval(() => {
    broadcastUpdate();
  }, DIAGNOSTICS_INTERVAL);

  const app = createServer(identity, peerManager, swarmManager, sseManager, diagnostics, databaseManager);
  startServer(app, identity);

  const handleShutdown = () => {
    diagnostics.stopLogging();
    swarmManager.shutdown();
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

main().catch(console.error);
