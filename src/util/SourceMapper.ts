import * as url from "url";
import path from "path";
import * as fs from "fs";
import vlq from "vlq";
import LiveSourceLocation from "../model/LiveSourceLocation";

export default class SourceMapper {
    mapped: Map<String, MappedFile>

    constructor() { // TODO: Pass root file path?
        this.mapped = new Map<String, MappedFile>();
    }

    map(scriptId: string, fileUrl: string, sourcemapFile?: string) {
        let basePath = process.cwd();
        let filePath = url.parse(fileUrl).path;
        let dirPath = path.parse(url.parse(fileUrl).path).dir;

        // No sourcemap was provided, so we assume the file was not transpiled
        if (!sourcemapFile) {
            let relative = path.relative(basePath, filePath);
            this.mapped.set(relative, new MappedFile(scriptId));
            return;
        }

        fs.readFile(`${dirPath}/${sourcemapFile}`, (err, data) => {
            if (err) {
                console.log(err);
                return;
            }

            let sourcemap = JSON.parse(data.toString());

            parseSourceMap(scriptId, sourcemap, dirPath)
                .forEach((file, source) => this.mapped.set(source, file))

            console.log(this.mapped)
        });
    }

    mapLocation(location: LiveSourceLocation): MappedLocation {
        let mappedFile: MappedFile = this.mapped.get(location.source);

        if (!mappedFile) return undefined;

        return {
            scriptId: mappedFile.scriptId,
            line: mappedFile.mapLine(location.line),
        }
    }
}

export interface MappedLocation {
    scriptId: string;
    line: number;
}

class MappedFile {
    scriptId: string
    // TODO: Line number mapping

    constructor(scriptId: string) {
        this.scriptId = scriptId;
    }

    mapLine(line: number): number {
        return line; // TODO
    }
}

function parseSourceMap(scriptId: string, sourcemap: any, dirPath: string): Map<String, MappedFile> {
    // TODO: Somehow handle sources being in a different direftory, for example if only the contents of the dist folder is uploaded
    // TODO: Handle running node in a different directory
    let basePath = process.cwd();

    let sources = sourcemap.sources
        .map(source => path.relative(basePath, `${dirPath}/${source}`)); // Find relative paths

    // TODO: Use sourceRoot from the sourcemap (it is blank in a lot of cases, but technically part of the specification)

    let mappings = sourcemap.mappings;
    let lines = mappings.split(";");
    let lineMappings = lines.map(line => line.split(","));

    let map = new Map<String, MappedFile>();
    for (let source of sources) {
        map.set(source, new MappedFile(scriptId));
    }

    return map;
}