import LiveInstrument from "../LiveInstrument";
import LiveInstrumentType from "../LiveInstrumentType";

export default class LiveLog extends LiveInstrument {
    type = LiveInstrumentType.LOG;
    logFormat: string
    logArguments: string[]

    createExpression(): string {
        let logArgumentsExpression = this.logArguments
            .map(arg => `data['${arg}'] = ${arg}.toString()`)
            .join(';');
        if (this.condition == null) {
            return `(() => { 
                let data = {success: true}; 
                (data => {${logArgumentsExpression}})(data); 
                return data;
            })()`;
        } else {
            return `(() => {
                if (${this.condition}) { 
                    let data = {success: true}; 
                    (data => {${logArgumentsExpression}})(data); 
                    returndata; 
                } else { 
                    return {success: false}; 
                }
            })()`;
        }
    }

    toJson(): any {
        return {
            ...super.toJson(),
            logFormat: this.logFormat,
            logArguments: this.logArguments
        };
    }
}