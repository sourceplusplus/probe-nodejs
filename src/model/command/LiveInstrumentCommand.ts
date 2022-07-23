import LiveInstrument from "../LiveInstrument";
import LiveSourceLocation from "../LiveSourceLocation";
import CommandType from "./CommandType";

export default interface LiveInstrumentCommand {
    commandType: CommandType
    instruments: LiveInstrument[]
    locations: LiveSourceLocation[]
}