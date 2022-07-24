export default interface LiveSourceLocation {
    source: string
    line: number
    service?: string
    serviceInstance?: string
    commitId?: string
    fileChecksum?: string
}