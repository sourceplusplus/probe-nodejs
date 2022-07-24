import LiveInstrument from "../LiveInstrument";
import LiveSourceLocation from "../LiveSourceLocation";
import CommandType from "./CommandType";
import LiveInstrumentUtil from "../LiveInstrumentUtil";

export default class LiveInstrumentCommand {
    commandType: CommandType
    instruments: LiveInstrument[]
    locations: LiveSourceLocation[]

    static fromJson(json: any): LiveInstrumentCommand {
        const command = new LiveInstrumentCommand();
        command.commandType = CommandType[json.commandType];
        command.instruments = json.instruments.map(instrument => LiveInstrumentUtil.fromJson(instrument));
        command.locations = json.locations.map(location => location as LiveSourceLocation);
        return command;
    }
}
