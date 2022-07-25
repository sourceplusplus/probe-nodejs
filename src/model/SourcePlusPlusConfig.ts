export default interface SourcePlusPlusConfig {
    spp?: ConfigSPP
    skywalking?: ConfigSkywalking
}

interface ConfigSPP {
    probe_id?: string
    host?: string
    grpc_port?: number
    rest_port?: number
    verify_host?: boolean
    ssl_enabled?: boolean
    probe_certificate?: string
    probe_metadata?: any
}

interface ConfigSkywalking {
    agent?: ConfigSkywalkingAgent
    collector?: ConfigSkywalkingCollector
}

interface ConfigSkywalkingAgent {
    service_name?: string
}

interface ConfigSkywalkingCollector {
    backend_service?: string
}
