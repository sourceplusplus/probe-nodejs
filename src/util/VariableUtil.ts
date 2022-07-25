import {Runtime} from "inspector";

namespace VariableUtil {
    export function processVariable(variable) {
        if (variable.value) {
            if (variable.value.description) {
                // Only consider the first line of description, since we do not want the entire class/function definition
                variable.value.description = variable.value.description.split('\n')[0];
            }
        }
        delete variable.writable;
        delete variable.configurable;
        delete variable.enumerable;
        delete variable.isOwn;
        return variable;
    }

    export function processVariables(variables) {
        for (let variable of variables) {
            processVariable(variable);
        }
        return variables;
    }

    export function encodeVariable(variable: Runtime.PropertyDescriptor) {
        if (!variable.value) {
            return JSON.stringify({
                '@class': "null",
                '@id': 'null',
                '@skip': 'Error: No variable value'
            });
        }
        let clazz, id, value;
        if (variable.value.type === 'object') {
            clazz = variable.value.className;
            id = variable.value.objectId;
            value = ""; // TODO: Include variable value
        } else if (variable.value.type === 'function') {
            // TODO: Correctly handle these, variable.value.description contains the entire class/function definition
            clazz = 'function';
            id = variable.value.objectId;
        } else {
            clazz = variable.value.type;
            id = ""; // Primitive types don't have an object id
            value = variable.value.value;
        }

        let obj = {
            '@class': clazz,
            '@id': id
        };
        obj[variable.name] = "";
        if (variable.value.value) {
            if (variable.value.type !== 'object') { // TODO: Handle arrays
                obj[variable.name] = value;
            } else {
                obj[variable.name] = variable.value.value.reduce((acc, v) => {
                    acc[v.name] = encodeVariable(v);
                    return acc;
                }, {});
            }
        }

        return JSON.stringify(obj);
    }
}

export default VariableUtil;