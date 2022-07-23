export default interface LiveSourceLocation {
    source: string
    line: number
    service?: string
    service_instance?: string
    commit_id?: string
    file_checksum?: string
}