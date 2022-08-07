declare module '@vertx/eventbus-bridge-client.js' {
    interface EventBusOptions {
        vertxbus_ping_interval?: number;
        vertxbus_reconnect_attempts_max?: number;
        vertxbus_reconnect_delay_min?: number;
        vertxbus_reconnect_delay_max?: number;
        vertxbus_reconnect_exponent?: number;
        vertxbus_randomization_factor?: number;

    }

    class EventBus {
        defaultHeaders: any | undefined;
        onopen: () => void;

        constructor(host: string, options?: any);

        send(address: string, message: any, headers: any | undefined, callback)
        publish(address: string, message: any, options?: any): void;
        registerHandler(address: string, headers: any, callback: (err: any | undefined, body: any | undefined) => void): void;
        unregisterHandler(address: string, headers: any, callback: (err: any | undefined, body: any | undefined) => void): void;
        enableReconnect(enable: boolean)
        close()
    }

    export = EventBus;
}
