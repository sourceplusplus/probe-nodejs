enum LiveInstrumentType {
    BREAKPOINT = "BREAKPOINT",
    LOG = "LOG",
    METER = "METER",
    SPAN = "SPAN",
}

// Workaround since we can't declare enums as the default export
export default LiveInstrumentType