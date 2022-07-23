import LiveVariableScope from "./LiveVariableScope";

export default interface LiveVariable {
    name: string
    value: any
    lineNumber: number
    scope?: LiveVariableScope
    liveClazz?: string
    liveIdentity?: string
    presentation?: string
}