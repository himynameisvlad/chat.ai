import { StreamResponse } from '../types';

interface Connection {
  id: string;
  response: StreamResponse;
  connectedAt: Date;
}

export class ConnectionRegistryService {
  private connections: Map<string, Connection> = new Map();

  register(id: string, response: StreamResponse): void {
    this.connections.set(id, {
      id,
      response,
      connectedAt: new Date(),
    });
    console.log(`📡 Connection registered: ${id} (total: ${this.connections.size})`);
  }

  unregister(id: string): void {
    if (this.connections.delete(id)) {
      console.log(`📡 Connection unregistered: ${id} (total: ${this.connections.size})`);
    }
  }

  broadcast(eventType: string, data: any): void {
    const deadConnections: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      try {
        if (connection.response.closed || !connection.response.writable) {
          deadConnections.push(id);
          continue;
        }

        const message = JSON.stringify({ type: eventType, ...data });
        connection.response.write(`data: ${message}\n\n`);
      } catch (error) {
        console.error(`Failed to send to connection ${id}:`, error);
        deadConnections.push(id);
      }
    }

    // Clean up dead connections
    deadConnections.forEach(id => this.unregister(id));
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  getActiveConnections(): Connection[] {
    return Array.from(this.connections.values());
  }
}

export const connectionRegistry = new ConnectionRegistryService();
