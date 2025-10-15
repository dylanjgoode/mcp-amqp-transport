#!/usr/bin/env node
import { Command } from 'commander';
import amqplib from 'amqplib';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

export interface RemoteMCPConfiguration {
    serverName: string;
    exchangeName: string;
    command: string;
    hostname?: string;
    port?: number;
    username?: string;
    password?: string;
    useTLS?: boolean;
    args?: string[];
}

class ReadBuffer {
    private buffer?: Buffer;

    append(chunk: Buffer): void {
        this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
    }

    readMessage(): any | null {
        if (!this.buffer) return null;
        const index = this.buffer.indexOf('\n');
        if (index === -1) return null;
        const line = this.buffer.toString('utf8', 0, index).replace(/\r$/, '');
        this.buffer = this.buffer.subarray(index + 1);
        return JSONRPCMessageSchema.parse(JSON.parse(line));
    }
}

async function main() {
    const program = new Command();
    
    program
        .requiredOption('--serverName <serverName>', 'MCP server name')
        .requiredOption('--exchangeName <exchangeName>', 'AMQP exchange name')
        .requiredOption('--command <command>', 'Command to run MCP server')
        .option('--hostname <hostname>', 'AMQP broker hostname')
        .option('--port <port>', 'AMQP broker port', parseInt)
        .option('--username <username>', 'AMQP username')
        .option('--password <password>', 'AMQP password')
        .option('--useTLS', 'Use TLS connection')
        .option('--args <args...>', 'Arguments for the command')
        .parse();
    
    const config: RemoteMCPConfiguration = program.opts();
    
    const hostname = config.hostname || process.env.AMQP_HOSTNAME;
    const useTLS = config.useTLS ?? (process.env.AMQP_USE_TLS === 'true');
    const port = config.port || parseInt(process.env.AMQP_PORT || '') || (useTLS ? 5671 : 5672);
    const username = config.username || process.env.AMQP_USERNAME;
    const password = config.password || process.env.AMQP_PASSWORD;
    
    if (!hostname) throw new Error('hostname must be provided via --hostname or AMQP_HOSTNAME environment variable');
    if (!username) throw new Error('username must be provided via --username or AMQP_USERNAME environment variable');
    if (!password) throw new Error('password must be provided via --password or AMQP_PASSWORD environment variable');
    
    const protocol = useTLS ? 'amqps' : 'amqp';
    const auth = `${username}:${password}@`;
    const url = `${protocol}://${auth}${hostname}:${port}`;
    
    const connection = await amqplib.connect(url);
    const channel = await connection.createChannel();
    
    await channel.assertExchange(config.exchangeName, 'topic', { durable: true });
    
    const subprocess = spawn(config.command, config.args || [], { stdio: ['pipe', 'pipe', 'inherit'] });
    const replyRoutingKeys = new Map<string | number, string>();
    
    const requestQueueName = `mcp-${config.serverName}-request`;
    const requestQueue = await channel.assertQueue(requestQueueName, { durable: true });
    await channel.bindQueue(requestQueue.queue, config.exchangeName, `mcp.${config.serverName}.request`);
    
    await channel.consume(requestQueue.queue, (msg) => {
        if (!msg) return;
        const message = JSON.parse(msg.content.toString());
        const routingKeyToReply = msg.properties.headers?.routingKeyToReply;
        if (routingKeyToReply && message.id !== undefined) {
            replyRoutingKeys.set(message.id, routingKeyToReply);
        }
        subprocess.stdin.write(JSON.stringify(message) + '\n');
        channel.ack(msg);
    });
    
    const readBuffer = new ReadBuffer();
    subprocess.stdout.on('data', (chunk: Buffer) => {
        readBuffer.append(chunk);
        while (true) {
            const message = readBuffer.readMessage();
            if (!message) break;
            
            const content = Buffer.from(JSON.stringify(message));
            const requestId = 'id' in message ? message.id : undefined;
            const routingKey = requestId !== undefined && replyRoutingKeys.has(requestId)
                ? replyRoutingKeys.get(requestId)!
                : `from-mcp.${config.serverName}`;
            
            if (requestId !== undefined) {
                replyRoutingKeys.delete(requestId);
            }
            
            channel.publish(config.exchangeName, routingKey, content, {
                persistent: true
            });
        }
    });
    
    subprocess.on('exit', async (code) => {
        console.error(`Subprocess exited with code ${code}`);
        await channel.close();
        await connection.close();
        process.exit(code || 0);
    });
    
    process.on('SIGINT', async () => {
        subprocess.kill();
        await channel.close();
        await connection.close();
        process.exit(0);
    });
}

main().catch(console.error);
