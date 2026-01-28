const { MongoClient } = require('mongodb');

class DatabaseManager {
    constructor(url) {
        this.client = new MongoClient(url);
    }

    async connect() {
        await this.client.connect();

        this.database = this.client.db('hypermind');
        this.messages = this.database.collection('messages');

        await this.messages.createIndex({ sig: 1 }, { unique: true });
    }

    async disconnect() {
        await this.client.close();
    }

    async addMessage(message) {
        try {
            await this.messages.insertOne(message);
        } catch (error) {
            if (error.code === 11000) {
                // Duplicate message, ignore
                return;
            }
            throw error;
        }
    }

    async getMessages() {
        return this.messages.find().toArray();
    }

}

module.exports = { DatabaseManager };