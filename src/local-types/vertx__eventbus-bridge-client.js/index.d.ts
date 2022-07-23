declare module '@vertx/eventbus-bridge-client.js' {
    class EventBus {
        constructor(host: string, port: number, options: any);

        sendPing(): void;
    }

    export = EventBus;
}