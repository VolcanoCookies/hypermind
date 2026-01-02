const { verifyPoW, verifySignature, createPublicKey } = require("../core/security");
const { MAX_RELAY_HOPS } = require("../config/constants");

class MessageHandler {
    constructor(peerManager, diagnostics, relayCallback, broadcastCallback) {
        this.peerManager = peerManager;
        this.diagnostics = diagnostics;
        this.relayCallback = relayCallback;
        this.broadcastCallback = broadcastCallback;
    }

    handleMessage(msg, sourceSocket) {
        if (!validateMessage(msg)) {
            return;
        }

        if (msg.type === "HEARTBEAT") {
            this.handleHeartbeat(msg, sourceSocket);
        } else if (msg.type === "LEAVE") {
            this.handleLeave(msg, sourceSocket);
        }
    }

    handleHeartbeat(msg, sourceSocket) {
        this.diagnostics.increment("heartbeatsReceived");
        const { id, seq, hops, nonce, sig } = msg;

        if (!verifyPoW(id, nonce)) {
            this.diagnostics.increment("invalidPoW");
            return;
        }

        const stored = this.peerManager.getPeer(id);
        if (stored && seq <= stored.seq) {
            this.diagnostics.increment("duplicateSeq");
            return;
        }

        if (!sig) return;

        try {
            let key;
            if (stored && stored.key) {
                key = stored.key;
            } else {
                if (!this.peerManager.canAcceptPeer(id)) return;
                key = createPublicKey(id);
            }

            if (!verifySignature(`seq:${seq}`, sig, key)) {
                this.diagnostics.increment("invalidSig");
                return;
            }

            if (hops === 0) {
                sourceSocket.peerId = id;
            }

            const wasNew = this.peerManager.addOrUpdatePeer(id, seq, key);

            if (wasNew) {
                this.diagnostics.increment("newPeersAdded");
                this.broadcastCallback();
            }

            if (hops < MAX_RELAY_HOPS) {
                this.diagnostics.increment("heartbeatsRelayed");
                this.relayCallback({ ...msg, hops: hops + 1 }, sourceSocket);
            }
        } catch (e) {
            return;
        }
    }

    handleLeave(msg, sourceSocket) {
        this.diagnostics.increment("leaveMessages");
        const { id, hops, sig } = msg;

        if (!sig) return;

        const stored = this.peerManager.getPeer(id);
        if (!stored || !stored.key) return;

        if (!verifySignature(`type:LEAVE:${id}`, sig, stored.key)) {
            this.diagnostics.increment("invalidSig");
            return;
        }

        if (this.peerManager.hasPeer(id)) {
            this.peerManager.removePeer(id);
            this.broadcastCallback();

            if (hops < MAX_RELAY_HOPS) {
                this.relayCallback({ ...msg, hops: hops + 1 }, sourceSocket);
            }
        }
    }
}

const validateMessage = (msg) => {
    if (!msg || typeof msg !== 'object') return false;
    if (!msg.type) return false;

    const msgSize = JSON.stringify(msg).length;
    if (msgSize > require("../config/constants").MAX_MESSAGE_SIZE) return false;

    if (msg.type === "HEARTBEAT") {
        const allowedFields = ['type', 'id', 'seq', 'hops', 'nonce', 'sig'];
        const fields = Object.keys(msg);
        return fields.every(f => allowedFields.includes(f)) &&
            msg.id && typeof msg.seq === 'number' &&
            typeof msg.hops === 'number' && msg.nonce && msg.sig;
    }

    if (msg.type === "LEAVE") {
        const allowedFields = ['type', 'id', 'hops', 'sig'];
        const fields = Object.keys(msg);
        return fields.every(f => allowedFields.includes(f)) &&
            msg.id && typeof msg.hops === 'number' && msg.sig;
    }

    return false;
}

module.exports = { MessageHandler, validateMessage };
