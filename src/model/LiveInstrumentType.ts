enum LiveInstrumentType {
    BREAKPOINT,
    LOG,
    METER,
    SPAN
}

// Workaround since we can't declare enums as the default export
export default LiveInstrumentType