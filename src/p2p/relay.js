const relayMessage = (msg, sourceSocket, swarm, diagnostics) => {
  const data = JSON.stringify(msg) + "\n";

  // Gossip Subsampling:
  // We relay to a subset of peers to prevent flooding, but scale with connection count.
  // We use a minimum of 6 or 25% of eligible peers, whichever is larger.
  
  const allSockets = Array.from(swarm.connections);
  const eligible = allSockets.filter((s) => s !== sourceSocket);
  
  const MIN_GOSSIP_COUNT = 6;
  const GOSSIP_FACTOR = 0.25; // Relay to 25% of peers
  const TARGET_GOSSIP_COUNT = Math.max(MIN_GOSSIP_COUNT, Math.ceil(eligible.length * GOSSIP_FACTOR));

  let targets = eligible;

  if (eligible.length > TARGET_GOSSIP_COUNT) {
    // Fisher-Yates shuffle (partial) to pick random peers
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    targets = eligible.slice(0, TARGET_GOSSIP_COUNT);
  }

  if (diagnostics) {
    diagnostics.increment("bytesRelayed", data.length * targets.length);
  }

  for (const socket of targets) {
    socket.write(data);
  }
};

module.exports = { relayMessage };
